import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Logo from '../components/common/Logo';
import Icon from '../components/common/Icon';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import { Avatar, Sparkle, DoodleHeart } from '../components/common/misc';
import CameraPreview from '../components/photobooth/CameraPreview';
import CameraControls from '../components/photobooth/CameraControls';
import PhotoSlots from '../components/photobooth/PhotoSlots';
import TemplateSelector from '../components/photobooth/TemplateSelector';
import StripPreview from '../components/photobooth/StripPreview';
import MusicPlayer from '../components/photobooth/MusicPlayer';
import LiveStripPlayer from '../components/photobooth/LiveStripPlayer';
import useCamera from '../components/photobooth/useCamera';
import { Link, useRouter } from '../lib/router';
import { useAuth } from '../context/AuthContext';
import { usePrefs } from '../context/PrefsContext';
import { useStrips } from '../context/StripsContext';
import { useToast } from '../context/ToastContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { FREE_STRIP_LIMIT } from '../config/catalog';
import { compositionSignature, createStripGate } from '../lib/stripGate';
import {
  LIVE,
  captureFrames,
  createLiveRenderer,
  encodeGif,
  extensionFor,
  liveFileName,
  recordVideo,
  releaseFrames,
  renderPoster,
  videoMimeType,
} from '../lib/liveStrip';
import { track } from '../lib/analytics';
import { ASPECTS, DEFAULT_LAYOUT_ID, DEFAULT_TEMPLATE_ID, TEMPLATES, getLayout, getTemplate } from '../templates/data';
import { renderStrip } from '../templates/render';
import { canvasToBlob, downloadBlob, printBlob, shareBlob, stripFileName } from '../lib/share';
import { playBeep, playShutter } from '../lib/sfx';

const SESSION_KEY = 'pb:booth-session';
const empty = (n) => Array(n).fill(null);
// The photos a layout shows: the first `n` captured photos (empty slots → null).
// Read-only view — never written back, so switching layouts can't lose photos.
const fitPhotos = (photos, n) => Array.from({ length: n }, (_, i) => photos[i] || null);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const readSession = () => {
  try {
    const s = JSON.parse(sessionStorage.getItem(SESSION_KEY));
    if (s && Array.isArray(s.photos)) return s;
  } catch {}
  return null;
};

export default function Booth() {
  const { user } = useAuth();
  const { prefs, setPref } = usePrefs();
  const strips = useStrips();
  const toast = useToast();
  const { query, navigate } = useRouter();
  const ent = useEntitlements();

  // ----- Session state (restored if the user left to log in) -----
  const restored = useRef(readSession());
  const layout = getLayout(prefs.layout);
  const slotCount = layout.photoCount;
  // Every photo taken for this strip, by slot index. Independent of the layout:
  // a layout with fewer slots only *shows* fewer (see `photos` below).
  const [captured, setCaptured] = useState(() => restored.current?.photos || []);
  const photos = useMemo(() => fitPhotos(captured, slotCount), [captured, slotCount]);
  /** Set (or clear, with null) the captured photo in one slot. */
  const setCapturedAt = useCallback((slot, shot) => {
    setCaptured((list) => {
      const next = Array.from({ length: Math.max(list.length, slot + 1) }, (_, i) => list[i] || null);
      next[slot] = shot;
      return next;
    });
  }, []);
  const [templateId, setTemplateId] = useState(() => {
    const fromQuery = query.get('template');
    if (fromQuery && TEMPLATES.some((t) => t.id === fromQuery)) return fromQuery;
    return restored.current?.templateId || prefs.lastTemplate;
  });
  const [selected, setSelected] = useState(() =>
    Math.max(0, fitPhotos(restored.current?.photos || [], slotCount).findIndex((p) => !p))
  );
  const [saved, setSaved] = useState(null); // { id, favorite } for the current composition
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);
  const [flash, setFlash] = useState(null); // 'screen' | 'frame'
  const [resultOpen, setResultOpen] = useState(false);
  const [busyAction, setBusyAction] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // ----- Live Strip mode (boomerang). Photo mode state above is untouched by it. -----
  const mode = prefs.boothMode === 'live' ? 'live' : 'photo';
  // One Live clip per slot — the single source of truth, independent of the layout
  // (like `captured` for photos): [{ id, frames, thumb } | null, …]. Frames are canvases
  // captured once per clip (never per-frame state).
  const [liveClips, setLiveClips] = useState([]);
  const liveClipsRef = useRef(liveClips);
  liveClipsRef.current = liveClips;
  const [liveSelected, setLiveSelected] = useState(null); // slot chosen for the next (re)take
  const [livePhase, setLivePhase] = useState(null); // 'countdown' | 'recording' | null
  const [liveProgress, setLiveProgress] = useState(0);
  const liveExport = useRef({}); // cached video/poster for the current composition
  // What the current layout shows; `live` is null until at least one clip exists.
  const liveVisible = useMemo(() => fitPhotos(liveClips, slotCount), [liveClips, slotCount]);
  const live = useMemo(
    () => (liveVisible.some(Boolean) ? { clips: liveVisible, id: liveVisible.map((c) => (c ? c.id : '-')).join(',') } : null),
    [liveVisible]
  );
  const liveTarget = liveSelected !== null && liveSelected < slotCount ? liveSelected : liveVisible.findIndex((c) => !c);
  const liveFull = liveVisible.every(Boolean);
  useEffect(() => {
    liveExport.current = {};
  }, [live]);
  // Free every clip's canvases when leaving the booth.
  useEffect(() => () => liveClipsRef.current.forEach((c) => releaseFrames(c?.frames)), []);

  // ----- Free photostrip allowance (enforced by the database; see lib/stripGate) -----
  const { stripUsage, setStripUsage } = ent;
  const [creation, setCreation] = useState(() => restored.current?.creation || null);
  const gateRef = useRef(null);
  if (!gateRef.current) {
    gateRef.current = createStripGate({ initial: restored.current?.creation, onChange: setCreation, onUsage: setStripUsage });
  }
  const gate = gateRef.current;
  const limitReached = !!stripUsage && !stripUsage.unlimited && stripUsage.used >= stripUsage.limit;
  const openUpgradeFn = ent.openUpgrade;
  const showLimit = useCallback(
    () =>
      openUpgradeFn({
        feature: 'unlimited_strips',
        title: `You’ve reached your ${FREE_STRIP_LIMIT} free photostrips`,
        description: 'Upgrade to Premium to create unlimited photostrips.',
      }),
    [openUpgradeFn]
  );
  // A different account (or signing out) must not reuse this browser's creation.
  const userIdRef = useRef(user?.id);
  useEffect(() => {
    if (userIdRef.current !== user?.id) gate.reset();
    userIdRef.current = user?.id;
  }, [user?.id, gate]);

  const template = getTemplate(templateId);

  // Templates designed for a specific arrangement (e.g. Comic Pop's panels) switch
  // to it when chosen; the user can still pick another layout afterwards.
  // `userLayoutRef` remembers the user's own layout while a template-applied one is
  // active, so switching back to a regular template restores it.
  const userLayoutRef = useRef(null);
  const { canUseTemplate, openUpgrade } = ent;
  const selectTemplate = useCallback(
    (id) => {
      const t = getTemplate(id);
      if (!canUseTemplate(t)) {
        openUpgrade({
          feature: 'premium_templates',
          title: `Unlock “${t.name}”`,
          description: `${t.name} is a Premium template. Upgrade to use it — plus every other Premium look.`,
        });
        return;
      }
      track('template_selected', { template: id, source: 'booth' });
      setTemplateId(id);
      if (t.layoutId) {
        if (userLayoutRef.current === null) userLayoutRef.current = prefs.layout;
        setPref({ layout: t.layoutId });
      } else if (userLayoutRef.current !== null) {
        setPref({ layout: userLayoutRef.current });
        userLayoutRef.current = null;
      }
    },
    [setPref, prefs.layout, canUseTemplate, openUpgrade]
  );

  // Arriving from the gallery with ?template=… applies that template's layout too.
  useEffect(() => {
    const fromQuery = query.get('template');
    if (fromQuery && fromQuery === templateId && template.layoutId && prefs.layout !== template.layoutId) {
      userLayoutRef.current = prefs.layout;
      setPref({ layout: template.layoutId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const aspect = (ASPECTS.find((a) => a.id === prefs.aspect) || ASPECTS[0]).value;
  const camera = useCamera(prefs.cameraId);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const runRef = useRef(0);
  const filled = photos.filter(Boolean).length;

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ photos: captured, templateId, creation }));
    } catch {
      /* storage full — session restore is best-effort */
    }
  }, [captured, templateId, creation]);

  useEffect(() => {
    if (prefs.lastTemplate !== templateId) setPref({ lastTemplate: templateId });
  }, [templateId, prefs.lastTemplate, setPref]);

  // Any change to the composition means it's no longer the saved version.
  useEffect(() => setSaved(null), [photos, templateId, prefs.aspect, prefs.layout, prefs.filter, live, mode]);

  // Layout changed: only move the selection to the first empty visible slot.
  // Captured photos are left untouched (switching back shows them all again).
  useEffect(() => {
    const firstEmpty = photosRef.current.findIndex((x) => !x);
    setSelected(firstEmpty >= 0 ? firstEmpty : 0);
  }, [slotCount]);

  // Stop a running sequence when leaving the page.
  useEffect(() => () => void runRef.current++, []);

  useEffect(() => {
    track('photobooth_opened');
  }, []);

  // Once the plan is known, fall back from anything this account can't use
  // (e.g. a Premium template opened by link, or settings kept after a downgrade).
  const entReady = ent.ready;
  useEffect(() => {
    if (!entReady) return;
    if (!ent.canUseTemplate(template)) {
      if (query.get('template') === template.id) {
        ent.openUpgrade({
          feature: 'premium_templates',
          title: `Unlock “${template.name}”`,
          description: `${template.name} is a Premium template. We’ve switched you to a free template for now.`,
        });
      }
      userLayoutRef.current = null;
      setTemplateId(DEFAULT_TEMPLATE_ID);
    }
    if (!ent.canUseLayout(prefs.layout)) setPref({ layout: DEFAULT_LAYOUT_ID });
    if (!ent.canUseFilter(prefs.filter || 'auto')) setPref({ filter: 'auto' });
    if (prefs.hd && !ent.canUseFeature('hd_export')) setPref({ hd: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entReady, ent.entitlements, template.id, prefs.layout, prefs.filter]);

  // ----- Capture -----
  const triggerFlash = useCallback(() => {
    setFlash(prefs.flash ? 'screen' : 'frame');
    setTimeout(() => setFlash(null), prefs.flash ? 420 : 260);
  }, [prefs.flash]);

  const stop = () => {
    runRef.current++;
    setBusy(false);
    setCount(0);
    setLivePhase(null);
  };

  const claimingRef = useRef(false);
  const startCapture = async () => {
    if (busy) {
      stop();
      return;
    }
    if (claimingRef.current) return; // a click is already being checked
    if (camera.status !== 'ready') {
      toast.error('Camera not ready', camera.error || 'Please wait for the camera to start.');
      return;
    }
    if (!user) {
      toast.info('Log in to create your strip', `Free accounts include ${FREE_STRIP_LIMIT} photostrips — it only takes a minute.`);
      navigate('/login?next=/booth');
      return;
    }
    let current = photosRef.current;
    const freshStrip = prefs.captureMode !== 'single' && current.every(Boolean);
    const emptyStrip = current.every((p) => !p);
    // Starting a new strip needs a creation from the database (Free: 2 in total).
    if (freshStrip || emptyStrip || !gate.active) {
      if (freshStrip || emptyStrip) gate.beginStrip();
      claimingRef.current = true;
      let res;
      try {
        res = await gate.ensureCreation({ template: template.id, layout: layout.id });
      } catch (err) {
        toast.error('Couldn’t start your strip', err.message);
        return;
      } finally {
        claimingRef.current = false;
      }
      if (!res.allowed) {
        showLimit();
        return;
      }
    }
    const run = ++runRef.current;
    let targets;
    if (prefs.captureMode === 'single') {
      targets = [selected];
    } else if (freshStrip) {
      // A full strip: start a fresh one (matches the original "take another" behaviour).
      current = empty(slotCount);
      setCaptured([]);
      targets = current.map((_, i) => i);
    } else {
      targets = [selected, ...current.map((p, i) => (!p && i !== selected ? i : -1)).filter((i) => i >= 0)];
    }

    setBusy(true);
    for (const slot of targets) {
      setSelected(slot);
      for (let s = prefs.countdown; s > 0; s--) {
        if (runRef.current !== run) return;
        setCount(s);
        if (prefs.sound) playBeep(s === 1);
        await wait(1000);
      }
      if (runRef.current !== run) return;
      setCount(0);
      const shot = camera.capture({ aspect, mirror: prefs.mirror });
      if (!shot) {
        toast.error('Capture failed', 'The camera stopped responding. Try again.');
        break;
      }
      triggerFlash();
      if (prefs.sound) playShutter();
      setCapturedAt(slot, shot);
      track('photo_captured', { template: template.id, layout: layout.id });
      await wait(targets.length > 1 ? 750 : 200);
    }
    if (runRef.current !== run) return;
    setBusy(false);
    const after = photosRef.current;
    const nextEmpty = after.findIndex((p) => !p);
    if (nextEmpty >= 0) setSelected(nextEmpty);
    else {
      setResultOpen(true);
      const stripMeta = { template: template.id, layout: layout.id, filter: prefs.filter || 'auto' };
      track('photostrip_created', stripMeta);
      track('template_used', stripMeta);
    }
  };

  /** Live Strip: countdown → ~2 s of frames → boomerang preview. */
  const takeLive = async () => {
    if (livePhase === 'countdown') {
      stop();
      return;
    }
    if (livePhase || claimingRef.current) return;
    if (camera.status !== 'ready') {
      toast.error('Camera not ready', camera.error || 'Please wait for the camera to start.');
      return;
    }
    if (!user) {
      toast.info('Log in to create your strip', `Free accounts include ${FREE_STRIP_LIMIT} photostrips — it only takes a minute.`);
      navigate('/login?next=/booth');
      return;
    }
    // Which slot this clip fills: the one the user picked (retake), else the next empty one.
    // A full strip with nothing picked starts a new strip.
    let slot = liveTarget;
    const freshStrip = slot < 0;
    const emptyStrip = liveVisible.every((c) => !c);
    if (freshStrip) slot = 0;
    // A Live Strip is a photostrip creation like any other (Free: counts toward the 2).
    if (freshStrip || emptyStrip || !gate.active) {
      if (freshStrip || emptyStrip) gate.beginStrip();
      claimingRef.current = true;
      let res;
      try {
        res = await gate.ensureCreation({ template: template.id, layout: layout.id });
      } catch (err) {
        toast.error('Couldn’t start your strip', err.message);
        return;
      } finally {
        claimingRef.current = false;
      }
      if (!res.allowed) {
        showLimit();
        return;
      }
    }
    if (freshStrip) {
      liveClipsRef.current.forEach((c) => releaseFrames(c?.frames));
      setLiveClips([]);
    }

    const run = ++runRef.current;
    setResultOpen(false);
    setLivePhase('countdown');
    for (let sec = prefs.countdown || 3; sec > 0; sec--) {
      if (runRef.current !== run) return;
      setCount(sec);
      if (prefs.sound) playBeep(sec === 1);
      await wait(1000);
    }
    if (runRef.current !== run) return;
    setCount(0);
    setLiveProgress(0);
    setLivePhase('recording');
    if (prefs.sound) playShutter();
    let frames;
    try {
      frames = await captureFrames(camera.videoRef.current, {
        aspect,
        mirror: prefs.mirror,
        onProgress: setLiveProgress,
        isCancelled: () => runRef.current !== run,
      });
    } catch (err) {
      toast.error('Capture failed', err.message);
      setLivePhase(null);
      return;
    }
    if (runRef.current !== run || frames.length < LIVE.frames) {
      releaseFrames(frames);
      return;
    }
    setLivePhase(null);
    triggerFlash();
    const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const clip = { id, frames, thumb: frames[0].toDataURL('image/jpeg', 0.7) };
    // Replace ONLY this slot (its own frames); every other slot keeps its clip.
    const base = freshStrip ? [] : liveClipsRef.current;
    const next = Array.from({ length: Math.max(base.length, slot + 1) }, (_, i) => base[i] || null);
    releaseFrames(next[slot]?.frames);
    next[slot] = clip;
    setLiveClips(next);
    const nextEmpty = fitPhotos(next, slotCount).findIndex((c) => !c);
    setLiveSelected(nextEmpty >= 0 ? nextEmpty : null);
    if (nextEmpty < 0) {
      setResultOpen(true);
      const stripMeta = { template: template.id, layout: layout.id, filter: prefs.filter || 'auto', kind: 'live' };
      track('photostrip_created', stripMeta);
      track('template_used', stripMeta);
    }
  };

  const clearLive = () => {
    stop();
    gate.beginStrip();
    liveClipsRef.current.forEach((c) => releaseFrames(c?.frames));
    setLiveClips([]);
    setLiveSelected(null);
    setResultOpen(false);
  };

  const removeLiveClip = (i) => {
    releaseFrames(liveClipsRef.current[i]?.frames);
    setLiveClips((list) => list.map((c, k) => (k === i ? null : c)));
    setLiveSelected(i);
  };

  const setMode = (next) => {
    if (busy || livePhase || next === mode) return;
    setResultOpen(false);
    setPref({ boothMode: next });
  };

  // Slot thumbnails for Live mode: each slot's own clip (first frame), or empty.
  const liveThumbs = useMemo(() => liveVisible.map((c) => (c ? c.thumb : null)), [liveVisible]);

  // Keyboard shortcut: Space takes a photo (when not typing / on a control).
  const startRef = useRef(startCapture);
  startRef.current = mode === 'live' ? takeLive : startCapture;
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Space' || e.repeat) return;
      const tag = document.activeElement?.tagName;
      if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A'].includes(tag) || document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      startRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const clearPhotos = () => {
    stop();
    gate.beginStrip(); // an exported strip is done; an unexported draft is reused
    setCaptured([]);
    setSelected(0);
    setResultOpen(false);
  };

  const removePhoto = (i) => {
    setCapturedAt(i, null);
    setSelected(i);
  };

  // ----- Export actions -----
  const hdAllowed = ent.canUseFeature('hd_export');
  const exportBlob = async ({ scale = 1 } = {}) => {
    const canvas = await renderStrip(template, { photos, aspect, layout, filter: prefs.filter, scale });
    return { blob: await canvasToBlob(canvas, 'image/png'), width: canvas.width, height: canvas.height };
  };
  const meta = () => ({ template: template.id, layout: layout.id });

  const ensurePhotos = () => {
    if (mode === 'live') {
      if (live) return true;
      toast.info('No Live Strip yet', 'Press “Take Live Strip” first, then download or save it.');
      return false;
    }
    if (filled === 0) {
      toast.info('No photos yet', 'Take some photos first, then download your strip.');
      return false;
    }
    return true;
  };

  /**
   * Every export (download / save / share / print) is authorised by the database:
   * the first export locks this creation to the composition; a different
   * composition (other photos, template, layout or filter) is a new photostrip.
   */
  const exportedOnce = useRef(false);
  const authorizeExport = async () => {
    if (!user) {
      toast.info('Log in to create your strip', 'Your photos will be waiting for you right here.');
      navigate('/login?next=/booth');
      return false;
    }
    const signature = compositionSignature({
      // A Live Strip is identified by its capture; a photo strip by its photos.
      photos: mode === 'live' && live ? live.clips.map((c) => (c ? `live:${c.id}` : null)) : photos,
      templateId: template.id,
      layoutId: layout.id,
      filter: prefs.filter,
      aspect,
    });
    const res = await gate.authorizeExport(signature, { template: template.id, layout: layout.id });
    if (!res.allowed) {
      showLimit();
      return false;
    }
    if (res.created && exportedOnce.current && stripUsage && !stripUsage.unlimited) {
      toast.info('Counted as a new photostrip', 'Changing a strip after downloading it creates a new one.');
    }
    exportedOnce.current = true;
    return true;
  };

  const withAction = (id, fn) => async () => {
    if (!ensurePhotos()) return;
    setBusyAction(id);
    try {
      if (!(await authorizeExport())) return;
      await fn();
    } catch (err) {
      toast.error('Something went wrong', err.message);
    } finally {
      setBusyAction(null);
    }
  };

  const download = withAction('download', async () => {
    if (mode === 'live') {
      const { video } = await liveMedia();
      downloadBlob(video, liveFileName(template.name, extensionFor(video.type)));
      track('photostrip_downloaded', { ...meta(), source: 'booth', kind: 'live' });
      toast.success('Downloaded!', 'Your Live Strip was saved to your device.');
      return;
    }
    const hd = prefs.hd && hdAllowed;
    const { blob } = await exportBlob({ scale: hd ? 2 : 1 });
    downloadBlob(blob, stripFileName(template.name));
    track('photostrip_downloaded', { ...meta(), source: 'booth', hd });
    toast.success(hd ? 'Downloaded in HD!' : 'Downloaded!', 'Your photo strip was saved to your device.');
  });

  const toggleHd = (on) => {
    if (on && !hdAllowed) {
      openUpgrade({
        feature: 'hd_export',
        title: 'Unlock HD downloads',
        description: 'Premium downloads are rendered at 2× resolution — crisp enough to print.',
      });
      return;
    }
    setPref({ hd: on });
  };

  // ----- Live Strip export (video via MediaRecorder, GIF via gifenc) -----
  const liveOpts = () => ({ aspect, layout, filter: prefs.filter });
  /** The animation as a file (WebM / MP4, or GIF where video recording isn't supported) + poster. */
  const liveMedia = async () => {
    const key = [live.id, template.id, layout.id, prefs.filter, aspect].join('|');
    if (liveExport.current.key === key) return liveExport.current;
    const renderer = await createLiveRenderer(template, live.clips, { ...liveOpts(), scale: LIVE.exportScale });
    const poster = await renderPoster(renderer);
    if (videoMimeType()) toast.info('Creating your Live Strip…', 'This takes about 10 seconds.');
    const video = videoMimeType() ? await recordVideo(renderer) : await encodeGif(template, live.clips, liveOpts());
    liveExport.current = { key, video, poster, width: renderer.width, height: renderer.height };
    return liveExport.current;
  };

  const save = async (favorite = false) => {
    if (!user) {
      toast.info('Log in to save', 'Your photos will be waiting for you right here.');
      navigate('/login?next=/booth');
      return null;
    }
    if (saved) return saved;
    const live_ = mode === 'live' && live ? await liveMedia() : null;
    const { blob, width, height } = live_ ? { blob: live_.video, width: live_.width, height: live_.height } : await exportBlob();
    let rec;
    try {
      rec = await strips.save({
        ...(live_ ? { mediaType: 'live_strip', poster: live_.poster } : {}),
        blob,
        width,
        height,
        templateId: template.id,
        templateName: template.name,
        layoutId: layout.id,
        favorite,
        creationId: gate.state.id,
      });
    } catch (err) {
      if (/creation_required|strip_limit_reached/i.test(err.message)) {
        showLimit();
        return null;
      }
      // The database refuses Premium templates/layouts for free accounts.
      if (/premium_required/i.test(err.message)) {
        openUpgrade({
          feature: 'premium_templates',
          title: 'Saving this strip needs Premium',
          description: 'This strip uses a Premium template or layout. Upgrade to save it to My Photos — you can still download it.',
        });
        return null;
      }
      throw err;
    }
    track('photostrip_saved', { ...meta(), favorite });
    const s = { id: rec.id, favorite };
    setSaved(s);
    return s;
  };

  const saveAction = withAction('save', async () => {
    if (saved) {
      toast.info('Already saved', 'This strip is in My Photos.');
      return;
    }
    if (await save()) toast.success('Saved to My Photos', 'Find it any time in your gallery.');
  });

  const favorite = withAction('favorite', async () => {
    if (saved) {
      await strips.toggleFavorite(saved.id);
      setSaved((s) => ({ ...s, favorite: !s.favorite }));
      toast.success(saved.favorite ? 'Removed from favorites' : 'Added to favorites');
      return;
    }
    if (await save(true)) toast.success('Saved to favorites ♡', 'Find it under Favorites.');
  });

  const downloadGif = withAction('gif', async () => {
    const gif = await encodeGif(template, live.clips, liveOpts());
    downloadBlob(gif, liveFileName(template.name, 'gif'));
    track('photostrip_downloaded', { ...meta(), source: 'booth', kind: 'live_gif' });
    toast.success('GIF downloaded!', 'Perfect for sharing in chats.');
  });

  const share = withAction('share', async () => {
    if (mode === 'live') {
      const { video } = await liveMedia();
      const res = await shareBlob(video, liveFileName(template.name, extensionFor(video.type)));
      if (res === 'downloaded') toast.info('Sharing isn’t supported here', 'We downloaded the Live Strip so you can share it.');
      return;
    }
    const { blob } = await exportBlob();
    const res = await shareBlob(blob, stripFileName(template.name));
    if (res === 'downloaded') toast.info('Sharing isn’t supported here', 'We downloaded the strip so you can share it.');
  });

  const print = withAction('print', async () => {
    const { blob } = await exportBlob();
    printBlob(blob);
  });

  const actions =
    mode === 'live'
      ? [
          { id: 'download', label: videoMimeType() ? 'Download video' : 'Download GIF', short: 'Video', icon: 'download', onClick: download, disabled: !live },
          { id: 'gif', label: 'Download GIF', short: 'GIF', icon: 'image', onClick: downloadGif, disabled: !live },
          { id: 'save', label: saved ? 'Saved' : 'Save', icon: saved ? 'check' : 'save', onClick: saveAction, disabled: !live },
          { id: 'share', label: 'Share', icon: 'share', onClick: share, disabled: !live },
        ]
      : [
          { id: 'download', label: 'Download', icon: 'download', onClick: download },
          { id: 'save', label: saved ? 'Saved' : 'Save', icon: saved ? 'check' : 'save', onClick: saveAction },
          { id: 'share', label: 'Share', icon: 'share', onClick: share },
          { id: 'print', label: 'Print', icon: 'printer', onClick: print },
        ];

  const onCamera = (id) => setPref({ cameraId: id });
  const cameraValue = prefs.cameraId || camera.activeDeviceId;
  const shotLabel = `Get ready! Photo ${selected + 1} of ${slotCount}`;
  const statusLabel =
    camera.status === 'ready' ? 'Camera Ready' : camera.status === 'loading' ? 'Starting camera…' : 'Camera Off';

  const stableOnRendered = useCallback((u) => setPreviewUrl(u), []);
  const favorites = useMemo(() => prefs.favoriteTemplates, [prefs.favoriteTemplates]);

  return (
    <div className="booth">
      <header className="booth-header">
        <div className="booth-header-left">
          <Logo to={user ? '/dashboard' : '/'} />
        </div>
        <div className="booth-header-right">
          <span className={`status-pill status-${camera.status}`} role="status">
            <i aria-hidden="true" />
            {statusLabel}
          </span>
          <Sparkle size={16} className="booth-header-sparkle" />
          <span className="booth-tagline" aria-hidden="true">
            Smile • Click • Remember
          </span>
          {user ? (
            <>
              <Link to="/favorites" className="icon-btn icon-btn-plain booth-fav" aria-label="Favorites">
                <Icon name="heart" size={20} />
              </Link>
              <Link to="/dashboard" aria-label="Back to dashboard" className="booth-avatar">
                <Avatar user={user} size={36} />
              </Link>
            </>
          ) : (
            <Button to="/login?next=/booth" size="sm" variant="outline-primary">
              Log In
            </Button>
          )}
        </div>
      </header>

      <div className="booth-script" aria-hidden="true">
        <span className="script">Making</span>
        <span className="script">Memories</span>
        <DoodleHeart size={26} />
        <Sparkle size={14} className="deco-twinkle" style={{ left: '30%', top: '-30%' }} />
        <Sparkle size={18} className="deco-twinkle" style={{ left: '50%', bottom: '-50%', animationDelay: '1s' }} />
      </div>

      <main id="main" className={`booth-grid page-enter cols-${layout.columns}`}>
        <section className="camera-card card" aria-label="Camera">
          <CameraPreview
            camera={camera}
            aspect={aspect}
            mirror={prefs.mirror}
            countdown={count}
            shotLabel={mode === 'live' ? `Live clip ${Math.max(0, liveTarget) + 1} of ${slotCount} — get ready!` : shotLabel}
            flashing={flash === 'frame'}
            recording={livePhase === 'recording'}
            recordProgress={liveProgress}
          />
          <CameraControls
            devices={camera.devices}
            cameraId={cameraValue}
            onCamera={onCamera}
            prefs={prefs}
            setPref={setPref}
            disabled={busy || !!livePhase}
          />
          <div className="mode-switch segmented" role="group" aria-label="Capture mode">
            <button type="button" aria-pressed={mode === 'photo'} onClick={() => setMode('photo')} disabled={busy || !!livePhase}>
              <span aria-hidden="true">📸</span> Photo
            </button>
            <button type="button" aria-pressed={mode === 'live'} onClick={() => setMode('live')} disabled={busy || !!livePhase}>
              <span aria-hidden="true">🎞️</span> Live
            </button>
          </div>
          {mode === 'live' ? (
            <div className="camera-actions">
              <Button
                size="xl"
                className={`take-btn take-btn-live${livePhase ? ' is-busy' : ''}`}
                icon={livePhase === 'countdown' ? 'x' : 'sparkle'}
                onClick={takeLive}
                disabled={livePhase === 'recording' || (!livePhase && camera.status !== 'ready')}
              >
                {livePhase === 'recording'
                  ? 'Recording…'
                  : livePhase === 'countdown'
                    ? 'Stop'
                    : liveTarget < 0
                      ? 'Take New Live Strip'
                      : liveVisible[liveTarget]
                        ? `Retake Live ${liveTarget + 1}`
                        : live
                          ? `Take Live ${liveTarget + 1} of ${slotCount}`
                          : 'Take Live Strip'}
              </Button>
              <Button size="xl" variant="outline" icon="trash" onClick={clearLive} disabled={!live || !!livePhase}>
                Clear
              </Button>
            </div>
          ) : (
          <div className="camera-actions">
            <Button
              size="xl"
              className={`take-btn${busy ? ' is-busy' : ''}`}
              icon={busy ? 'x' : 'camera'}
              onClick={startCapture}
              disabled={!busy && camera.status !== 'ready'}
            >
              {busy ? 'Stop' : filled === slotCount && prefs.captureMode === 'auto' ? 'Take New Strip' : 'Take Photo'}
            </Button>
            <Button size="xl" variant="outline" icon="trash" onClick={clearPhotos} disabled={filled === 0 && !busy}>
              Clear Photos
            </Button>
          </div>
          )}
          <p className="camera-tip">
            {mode === 'live' ? (
              <>
                <kbd>Space</kbd> to start · ~2 seconds, plays forward &amp; back
              </>
            ) : (
              <>
                <kbd>Space</kbd> to take a photo · tap a slot to retake it
              </>
            )}
          </p>
          {user && stripUsage && !stripUsage.unlimited && (
            <div className={`strip-usage${limitReached && !creation?.id ? ' is-full' : ''}`} role="status">
              <span className="strip-usage-count">
                {Math.min(stripUsage.used, stripUsage.limit)} / {stripUsage.limit} Free Strips Used
              </span>
              {limitReached && !creation?.id && (
                <>
                  <p>
                    You’ve reached your {stripUsage.limit} free photostrips. Upgrade to Premium to create unlimited
                    photostrips.
                  </p>
                  <Button size="sm" icon="sparkle" to="/pricing" onClick={() => track('upgrade_clicked', { source: 'strip_limit' })}>
                    Upgrade to Premium
                  </Button>
                </>
              )}
            </div>
          )}
        </section>

        {mode === 'live' ? (
          <PhotoSlots
            photos={liveThumbs}
            selected={liveFull && liveSelected === null ? -1 : liveTarget}
            onSelect={setLiveSelected}
            onRemove={removeLiveClip}
            layout={layout}
            aspect={aspect}
            disabled={!!livePhase}
            live
          />
        ) : (
          <PhotoSlots
            photos={photos}
            selected={selected}
            onSelect={setSelected}
            onRemove={removePhoto}
            layout={layout}
            aspect={aspect}
            disabled={busy}
          />
        )}

        <div className="booth-side">
          <TemplateSelector value={templateId} onChange={selectTemplate} aspect={aspect} layout={layout} favorites={favorites} />
          <StripPreview
            template={template}
            layout={layout}
            photos={mode === 'live' ? liveThumbs : photos}
            live={mode === 'live' ? live || false : undefined}
            aspect={aspect}
            filter={prefs.filter}
            hd={prefs.hd}
            hdLocked={!hdAllowed}
            onToggleHd={mode === 'live' ? undefined : toggleHd}
            onRendered={stableOnRendered}
            actions={actions}
            favorite={!!saved?.favorite}
            onFavorite={favorite}
            busyAction={busyAction}
          />
        </div>
      </main>

      {flash === 'screen' && <div className="screen-flash" aria-hidden="true" />}

      <MusicPlayer />

      <Modal open={resultOpen} onClose={() => setResultOpen(false)} width={520} className="result-modal">
        <div className="result">
          <div className="result-strip">
            {mode === 'live' && live ? (
              <LiveStripPlayer template={template} clips={live.clips} layout={layout} aspect={aspect} filter={prefs.filter} />
            ) : (
              previewUrl && <img src={previewUrl} alt={`Your finished ${template.name} strip`} className="strip-img" />
            )}
            <Sparkle size={16} className="deco-twinkle" style={{ left: -18, top: 30 }} />
            <DoodleHeart size={26} style={{ right: -26, bottom: 40 }} />
          </div>
          <div className="result-body">
            <span className="badge">
              <Icon name="sparkle" size={12} /> {template.name}
            </span>
            <h2 className="result-title">
              {mode === 'live' ? 'Your Live Strip is ready!' : 'Your memories are ready!'} <span aria-hidden="true">❤️</span>
            </h2>
            <p className="muted">
              {mode === 'live'
                ? 'It plays forward and back on a loop. Download it as a video or GIF, or keep it in My Photos.'
                : 'Download your strip, keep it in My Photos, or strike another pose.'}
            </p>
            <div className="result-actions">
              <Button icon="download" block onClick={download} loading={busyAction === 'download'} data-autofocus>
                {mode === 'live' ? (videoMimeType() ? 'Download Video' : 'Download GIF') : 'Download'}
              </Button>
              {mode === 'live' && videoMimeType() && (
                <Button variant="outline" icon="image" block onClick={downloadGif} loading={busyAction === 'gif'}>
                  Download GIF
                </Button>
              )}
              <Button
                variant="outline"
                icon={saved ? 'check' : 'save'}
                block
                onClick={saveAction}
                loading={busyAction === 'save'}
              >
                {saved ? 'Saved to My Photos' : 'Save to My Photos'}
              </Button>
              <Button variant="ghost" icon="refresh" block onClick={mode === 'live' ? clearLive : clearPhotos}>
                Create Another
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
