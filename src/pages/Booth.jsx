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
import useCamera from '../components/photobooth/useCamera';
import { Link, useRouter } from '../lib/router';
import { useAuth } from '../context/AuthContext';
import { usePrefs } from '../context/PrefsContext';
import { useStrips } from '../context/StripsContext';
import { useToast } from '../context/ToastContext';
import { ASPECTS, TEMPLATES, getLayout, getTemplate } from '../templates/data';
import { renderStrip } from '../templates/render';
import { canvasToBlob, downloadBlob, printBlob, shareBlob, stripFileName } from '../lib/share';
import { playBeep, playShutter } from '../lib/sfx';

const SESSION_KEY = 'pb:booth-session';
const empty = (n) => Array(n).fill(null);
// Resize a photo list to a layout's slot count, keeping the photos already taken.
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

  // ----- Session state (restored if the user left to log in) -----
  const restored = useRef(readSession());
  const layout = getLayout(prefs.layout);
  const slotCount = layout.photoCount;
  const [photos, setPhotos] = useState(() => fitPhotos(restored.current?.photos || [], slotCount));
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

  const template = getTemplate(templateId);

  // Templates designed for a specific arrangement (e.g. Comic Pop's panels) switch
  // to it when chosen; the user can still pick another layout afterwards.
  // `userLayoutRef` remembers the user's own layout while a template-applied one is
  // active, so switching back to a regular template restores it.
  const userLayoutRef = useRef(null);
  const selectTemplate = useCallback(
    (id) => {
      setTemplateId(id);
      const t = getTemplate(id);
      if (t.layoutId) {
        if (userLayoutRef.current === null) userLayoutRef.current = prefs.layout;
        setPref({ layout: t.layoutId });
      } else if (userLayoutRef.current !== null) {
        setPref({ layout: userLayoutRef.current });
        userLayoutRef.current = null;
      }
    },
    [setPref, prefs.layout]
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
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ photos, templateId }));
    } catch {
      /* storage full — session restore is best-effort */
    }
  }, [photos, templateId]);

  useEffect(() => {
    if (prefs.lastTemplate !== templateId) setPref({ lastTemplate: templateId });
  }, [templateId, prefs.lastTemplate, setPref]);

  // Any change to the composition means it's no longer the saved version.
  useEffect(() => setSaved(null), [photos, templateId, prefs.aspect, prefs.layout]);

  // Layout changed: resize the slots (keeping existing photos) and jump to the first empty one.
  useEffect(() => {
    if (photosRef.current.length === slotCount) return;
    const next = fitPhotos(photosRef.current, slotCount);
    const firstEmpty = next.findIndex((x) => !x);
    setPhotos(next);
    setSelected(firstEmpty >= 0 ? firstEmpty : 0);
  }, [slotCount]);

  // Stop a running sequence when leaving the page.
  useEffect(() => () => void runRef.current++, []);

  // ----- Capture -----
  const triggerFlash = useCallback(() => {
    setFlash(prefs.flash ? 'screen' : 'frame');
    setTimeout(() => setFlash(null), prefs.flash ? 420 : 260);
  }, [prefs.flash]);

  const stop = () => {
    runRef.current++;
    setBusy(false);
    setCount(0);
  };

  const startCapture = async () => {
    if (busy) {
      stop();
      return;
    }
    if (camera.status !== 'ready') {
      toast.error('Camera not ready', camera.error || 'Please wait for the camera to start.');
      return;
    }
    const run = ++runRef.current;
    let current = photosRef.current;
    let targets;
    if (prefs.captureMode === 'single') {
      targets = [selected];
    } else if (current.every(Boolean)) {
      // A full strip: start a fresh one (matches the original "take another" behaviour).
      current = empty(slotCount);
      setPhotos(empty(slotCount));
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
      setPhotos((p) => {
        const n = [...p];
        n[slot] = shot;
        return n;
      });
      await wait(targets.length > 1 ? 750 : 200);
    }
    if (runRef.current !== run) return;
    setBusy(false);
    const after = photosRef.current;
    const nextEmpty = after.findIndex((p) => !p);
    if (nextEmpty >= 0) setSelected(nextEmpty);
    else setResultOpen(true);
  };

  // Keyboard shortcut: Space takes a photo (when not typing / on a control).
  const startRef = useRef(startCapture);
  startRef.current = startCapture;
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
    setPhotos(empty(slotCount));
    setSelected(0);
    setResultOpen(false);
  };

  const removePhoto = (i) => {
    setPhotos((p) => p.map((x, k) => (k === i ? null : x)));
    setSelected(i);
  };

  // ----- Export actions -----
  const exportBlob = async () => {
    const canvas = await renderStrip(template, { photos, aspect, layout, scale: 1 });
    return { blob: await canvasToBlob(canvas, 'image/png'), width: canvas.width, height: canvas.height };
  };

  const ensurePhotos = () => {
    if (filled === 0) {
      toast.info('No photos yet', 'Take some photos first, then download your strip.');
      return false;
    }
    return true;
  };

  const withAction = (id, fn) => async () => {
    if (!ensurePhotos()) return;
    setBusyAction(id);
    try {
      await fn();
    } catch (err) {
      toast.error('Something went wrong', err.message);
    } finally {
      setBusyAction(null);
    }
  };

  const download = withAction('download', async () => {
    const { blob } = await exportBlob();
    downloadBlob(blob, stripFileName(template.name));
    toast.success('Downloaded!', 'Your photo strip was saved to your device.');
  });

  const save = async (favorite = false) => {
    if (!user) {
      toast.info('Log in to save', 'Your photos will be waiting for you right here.');
      navigate('/login?next=/booth');
      return null;
    }
    if (saved) return saved;
    const { blob, width, height } = await exportBlob();
    const rec = await strips.save({ blob, width, height, templateId: template.id, templateName: template.name, layoutId: layout.id, favorite });
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

  const share = withAction('share', async () => {
    const { blob } = await exportBlob();
    const res = await shareBlob(blob, stripFileName(template.name));
    if (res === 'downloaded') toast.info('Sharing isn’t supported here', 'We downloaded the strip so you can share it.');
  });

  const print = withAction('print', async () => {
    const { blob } = await exportBlob();
    printBlob(blob);
  });

  const actions = [
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
            shotLabel={shotLabel}
            flashing={flash === 'frame'}
          />
          <CameraControls
            devices={camera.devices}
            cameraId={cameraValue}
            onCamera={onCamera}
            prefs={prefs}
            setPref={setPref}
            disabled={busy}
          />
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
          <p className="camera-tip">
            <kbd>Space</kbd> to take a photo · tap a slot to retake it
          </p>
        </section>

        <PhotoSlots
          photos={photos}
          selected={selected}
          onSelect={setSelected}
          onRemove={removePhoto}
          layout={layout}
          aspect={aspect}
          disabled={busy}
        />

        <div className="booth-side">
          <TemplateSelector value={templateId} onChange={selectTemplate} aspect={aspect} layout={layout} favorites={favorites} />
          <StripPreview
            template={template}
            layout={layout}
            photos={photos}
            aspect={aspect}
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
            {previewUrl && <img src={previewUrl} alt={`Your finished ${template.name} strip`} className="strip-img" />}
            <Sparkle size={16} className="deco-twinkle" style={{ left: -18, top: 30 }} />
            <DoodleHeart size={26} style={{ right: -26, bottom: 40 }} />
          </div>
          <div className="result-body">
            <span className="badge">
              <Icon name="sparkle" size={12} /> {template.name}
            </span>
            <h2 className="result-title">
              Your memories are ready! <span aria-hidden="true">❤️</span>
            </h2>
            <p className="muted">Download your strip, keep it in My Photos, or strike another pose.</p>
            <div className="result-actions">
              <Button icon="download" block onClick={download} loading={busyAction === 'download'} data-autofocus>
                Download
              </Button>
              <Button
                variant="outline"
                icon={saved ? 'check' : 'save'}
                block
                onClick={saveAction}
                loading={busyAction === 'save'}
              >
                {saved ? 'Saved to My Photos' : 'Save to My Photos'}
              </Button>
              <Button variant="ghost" icon="refresh" block onClick={clearPhotos}>
                Create Another
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
