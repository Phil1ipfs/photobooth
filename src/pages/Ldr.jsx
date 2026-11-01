// LDR (long-distance) photobooth: two people, two cameras, one shared strip.
//
// Sync model (Supabase Realtime, private channel 'ldr:<room id>' — members only):
//   Presence  → who is here, their camera status and whether they're ready
//   Broadcast → small events: settings, start (with the session plan), shot (a storage
//               path), abort, retake request/reply, shared music
// Photos never travel over Realtime: each person uploads their own shots to the
// private 'ldr' bucket and the partner downloads them. Both devices then render the
// same strip locally from the same photos + settings.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Logo from '../components/common/Logo';
import Icon from '../components/common/Icon';
import Button from '../components/common/Button';
import { SelectPill } from '../components/common/Input';
import Modal from '../components/common/Modal';
import FeatureGate from '../components/billing/FeatureGate';
import { Avatar } from '../components/common/misc';
import CameraPreview from '../components/photobooth/CameraPreview';
import TemplateSelector from '../components/photobooth/TemplateSelector';
import StripPreview from '../components/photobooth/StripPreview';
import MusicPlayer from '../components/photobooth/MusicPlayer';
import MusicThemeHint from '../components/photobooth/MusicThemeHint';
import useCamera from '../components/photobooth/useCamera';
import { useRouter } from '../lib/router';
import { useAuth } from '../context/AuthContext';
import { usePrefs } from '../context/PrefsContext';
import { useStrips } from '../context/StripsContext';
import { useToast } from '../context/ToastContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { useMusic } from '../context/MusicContext';
import { supabase } from '../lib/supabase';
import { FILTERS, FREE_STRIP_LIMIT } from '../config/catalog';
import { compositionSignature, createStripGate } from '../lib/stripGate';
import { LDR_ARRANGEMENTS, arrange, createRoom, downloadShot, getArrangement, inviteLink, joinRoom, planFor, removeMyShots, topicFor, uploadShot } from '../lib/ldr';
import { TEMPLATES, getTemplate } from '../templates/data';
import { renderStrip } from '../templates/render';
import { canvasToBlob, downloadBlob, printBlob, shareBlob, stripFileName } from '../lib/share';
import { playBeep, playShutter } from '../lib/sfx';
import { track } from '../lib/analytics';

const ASPECT = 4 / 3; // both people shoot the same shape so the strip matches
const PARTNER_TIMEOUT_MS = 45000;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const newSessionId = () => Math.random().toString(36).slice(2, 10);
const RUNNING = ['countdown', 'pose', 'waiting'];

/** Validate settings from the partner (trust boundary). */
const cleanSettings = (s) =>
  s && TEMPLATES.some((t) => t.id === s.templateId) && LDR_ARRANGEMENTS.some((a) => a.id === s.arrangementId)
    ? { templateId: s.templateId, arrangementId: s.arrangementId, caption: String(s.caption || '').slice(0, 40), filter: FILTERS.some((f) => f.id === s.filter) ? s.filter : 'auto' }
    : null;

export default function Ldr() {
  return <FeatureGate feature="ldr_rooms"><LdrPage /></FeatureGate>;
}

function LdrPage() {
  const { query, navigate } = useRouter();
  const toast = useToast();
  const code = (query.get('room') || '').toUpperCase();
  const [room, setRoom] = useState(null);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    if (!code || room?.code === code) return;
    let alive = true;
    setJoining(true);
    setJoinError('');
    joinRoom(code)
      .then((r) => alive && setRoom(r))
      .catch((err) => alive && setJoinError(err.message))
      .finally(() => alive && setJoining(false));
    return () => {
      alive = false;
    };
  }, [code, room?.code]);

  const create = async () => {
    setJoining(true);
    try {
      const r = await createRoom();
      setRoom(r);
      navigate(`/ldr?room=${r.code}`, { replace: true });
    } catch (err) {
      toast.error('Couldn’t create a room', err.message);
    } finally {
      setJoining(false);
    }
  };

  const leave = () => {
    setRoom(null);
    navigate('/ldr');
  };
  if (room) return <Room room={room} onLeave={leave} />;
  return <Lobby busy={joining} error={joinError} onCreate={create} onJoin={(c) => navigate(`/ldr?room=${c.trim().toUpperCase()}`)} initialCode={code} />;
}

function Lobby({ busy, error, onCreate, onJoin, initialCode }) {
  const [value, setValue] = useState(initialCode);
  return (
    <div className="booth ldr">
      <header className="booth-header">
        <Logo to="/dashboard" />
      </header>
      <main id="main" className="ldr-lobby page-enter">
        <section className="card ldr-lobby-card">
          <span className="ldr-hearts" aria-hidden="true">💞</span>
          <h1>LDR Photobooth</h1>
          <p className="muted">
            Take photos together from two different places. Create a private room, send your partner the link, and you’ll both
            count down and smile at the same time — then get one shared strip.
          </p>
          <Button size="lg" icon="plus" block onClick={onCreate} loading={busy && !initialCode} disabled={busy}>
            Create a room
          </Button>
          <div className="ldr-or">or join with a code</div>
          <form
            className="ldr-join"
            onSubmit={(e) => {
              e.preventDefault();
              if (value.trim()) onJoin(value);
            }}
          >
            <input
              className="input"
              value={value}
              onChange={(e) => setValue(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="ABC123"
              aria-label="Room code"
              autoCapitalize="characters"
              inputMode="text"
            />
            <Button type="submit" variant="outline-primary" loading={busy && !!initialCode} disabled={busy || value.length !== 6}>
              Join
            </Button>
          </form>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <p className="ldr-fine">Rooms are private to the two of you and expire after 3 hours.</p>
        </section>
      </main>
    </div>
  );
}

function Room({ room, onLeave }) {
  const { user } = useAuth();
  const { prefs } = usePrefs();
  const strips = useStrips();
  const toast = useToast();
  const ent = useEntitlements();
  const music = useMusic();
  const camera = useCamera(prefs.cameraId);
  const role = room.host_id === user.id ? 'A' : 'B';

  // ----- Connection & presence -----
  const channelRef = useRef(null);
  const [conn, setConn] = useState('connecting'); // connecting | live | error
  const [partner, setPartner] = useState(null); // { userId, name, ready, camera } | null
  const [hadPartner, setHadPartner] = useState(false);
  const [ready, setReady] = useState(false);
  const send = useCallback((payload) => channelRef.current?.send({ type: 'broadcast', event: 'msg', payload }), []);

  // ----- Shared settings -----
  const [settings, setSettingsState] = useState({ templateId: ent.canUseTemplate(getTemplate('miles-apart')) ? 'miles-apart' : 'love-hearts', arrangementId: 'alternate', caption: '', filter: 'auto' });
  const template = getTemplate(settings.templateId);
  const arrangement = getArrangement(settings.arrangementId);
  const plan = useMemo(() => planFor(arrangement), [arrangement]);

  // ----- Session -----
  const [phase, setPhase] = useState('idle'); // idle | countdown | pose | waiting | done
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const [count, setCount] = useState(0);
  const [round, setRound] = useState(0);
  const [flash, setFlash] = useState(false);
  const [mine, setMine] = useState([]);
  const [theirs, setTheirs] = useState([]);
  const sessionRef = useRef(null); // { sid, rounds }
  const runRef = useRef(0);
  const [retake, setRetake] = useState(null); // null | 'sent' | 'received'
  const [resultOpen, setResultOpen] = useState(false);

  const shots = role === 'A' ? { A: mine, B: theirs } : { A: theirs, B: mine };
  const photos = useMemo(() => arrange(plan.slots, shots), [plan, shots.A, shots.B]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- Expiry -----
  const expiresAt = useMemo(() => new Date(room.expires_at).getTime(), [room.expires_at]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const expired = now >= expiresAt;
  const minutesLeft = Math.max(0, Math.round((expiresAt - now) / 60000));

  const abort = useCallback(
    (reason, { notify = false } = {}) => {
      runRef.current++;
      if (notify) send({ type: 'abort', sid: sessionRef.current?.sid, reason });
      sessionRef.current = null;
      setPhase('idle');
      setCount(0);
      setReady(false);
      if (reason) toast.error('Session stopped', reason);
    },
    [send, toast]
  );

  useEffect(() => {
    if (expired && RUNNING.includes(phaseRef.current)) abort('This room has expired.');
  }, [expired, abort]);

  // ----- Capture session (runs on both devices from the same 'start' message) -----
  const runSession = async (msg) => {
    const next = cleanSettings(msg.settings);
    if (!next || !/^[a-z0-9]{4,12}$/.test(msg.sid || '')) return;
    const p = planFor(getArrangement(next.arrangementId));
    const countdown = Math.min(5, Math.max(3, Number(msg.countdown) || 3));
    setSettingsState(next);
    const run = ++runRef.current;
    sessionRef.current = { sid: msg.sid, rounds: p.rounds };
    setMine([]);
    setTheirs([]);
    setResultOpen(false);
    setRetake(null);
    const taken = [];
    for (let r = 0; r < p.rounds; r++) {
      setRound(r);
      setPhase('countdown');
      for (let s = countdown; s > 0; s--) {
        if (runRef.current !== run) return;
        setCount(s);
        if (prefs.sound) playBeep(s === 1);
        await wait(1000);
      }
      if (runRef.current !== run) return;
      setCount(0);
      const shot = camera.capture({ aspect: ASPECT, mirror: prefs.mirror });
      if (!shot) {
        abort('Your camera stopped responding.', { notify: true });
        return;
      }
      setFlash(true);
      setTimeout(() => setFlash(false), 260);
      if (prefs.sound) playShutter();
      taken[r] = shot;
      setMine([...taken]);
      uploadShot({ roomId: room.id, userId: user.id, sessionId: msg.sid, round: r, dataUrl: shot })
        .then((path) => runRef.current === run && send({ type: 'shot', sid: msg.sid, round: r, path }))
        .catch(() => runRef.current === run && abort('Couldn’t send your photo. Check your connection and try again.', { notify: true }));
      if (r < p.rounds - 1) {
        setPhase('pose');
        await wait(1500);
      }
    }
    if (runRef.current === run) setPhase('waiting');
  };

  // Both sides have every shot → the strip is done.
  useEffect(() => {
    const s = sessionRef.current;
    if (phase !== 'waiting' || !s) return undefined;
    const full = (list) => list.filter(Boolean).length >= s.rounds;
    if (full(mine) && full(theirs)) {
      setPhase('done');
      setReady(false);
      setResultOpen(true);
      track('photostrip_created', { template: template.id, layout: plan.layout.id, kind: 'ldr' });
      return undefined;
    }
    const t = setTimeout(() => abort('Your partner’s photos didn’t arrive. Check both connections and try again.', { notify: true }), PARTNER_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [phase, mine, theirs, abort, template.id, plan.layout.id]);

  // ----- Messages from the partner -----
  const onMessage = (msg) => {
    switch (msg?.type) {
      case 'hello':
        if (role === 'A') {
          send({ type: 'settings', settings });
          if (music.playing) send({ type: 'music', snap: music.snapshot(true) });
        }
        break;
      case 'settings': {
        const next = cleanSettings(msg.settings);
        if (next && !RUNNING.includes(phaseRef.current)) setSettingsState(next);
        break;
      }
      case 'start':
        if (!RUNNING.includes(phaseRef.current) && !expired) runSession(msg);
        break;
      case 'shot': {
        const s = sessionRef.current;
        if (!s || msg.sid !== s.sid || !Number.isInteger(msg.round) || msg.round < 0 || msg.round >= s.rounds) break;
        downloadShot({ roomId: room.id, partnerId: partner?.userId || (role === 'A' ? room.guest_id : room.host_id), path: msg.path })
          .then((url) => {
            if (sessionRef.current?.sid !== s.sid) return;
            setTheirs((list) => {
              const next = [...list];
              next[msg.round] = url;
              return next;
            });
          })
          .catch(() => abort('Couldn’t load your partner’s photo. Please try again.', { notify: true }));
        break;
      }
      case 'abort':
        if (sessionRef.current && msg.sid === sessionRef.current.sid) abort(typeof msg.reason === 'string' ? `Your partner’s side: ${msg.reason.slice(0, 140)}` : 'Your partner stopped the session.');
        break;
      case 'retake-request':
        setRetake('received');
        break;
      case 'retake-reply':
        setRetake(null);
        if (msg.ok) resetForRetake();
        else toast.info('Keeping these photos', `${partner?.name || 'Your partner'} wants to keep this strip.`);
        break;
      case 'music': {
        const before = music.track.id;
        music.applyRemote(msg.snap);
        if (Array.isArray(msg.snap?.queue) && msg.snap.trackId && msg.snap.trackId !== before) toast.info('Now playing together', `${partner?.name || 'Your partner'} picked a song.`);
        break;
      }
      case 'music-error':
        toast.info('That song didn’t play for your partner', 'Pick another one so you can both listen.');
        break;
      default:
    }
  };
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const resetForRetake = () => {
    runRef.current++;
    sessionRef.current = null;
    setMine([]);
    setTheirs([]);
    setPhase('idle');
    setResultOpen(false);
    setReady(true); // both agreed — the countdown starts once both cameras are ready
  };

  // ----- Realtime channel -----
  const userName = user.name;
  useEffect(() => {
    let closed = false;
    const ch = supabase.channel(topicFor(room.id), { config: { private: true, broadcast: { self: false }, presence: { key: user.id, enabled: true } } });
    channelRef.current = ch;
    ch.on('broadcast', { event: 'msg' }, ({ payload }) => onMessageRef.current(payload))
      .on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState();
        const key = Object.keys(state).find((k) => k !== user.id);
        const meta = key && state[key][0];
        setPartner(meta ? { userId: key, name: String(meta.name || 'Your partner').slice(0, 40), ready: !!meta.ready, camera: meta.camera } : null);
        if (meta) setHadPartner(true);
      });
    (async () => {
      await supabase.realtime.setAuth(); // private channel: authorize with this user's session
      if (closed) return;
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConn('live');
          ch.send({ type: 'broadcast', event: 'msg', payload: { type: 'hello' } });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setConn('error');
      });
    })();
    const cleanup = () => removeMyShots(room.id, user.id).catch(() => {});
    window.addEventListener('pagehide', cleanup);
    return () => {
      closed = true;
      window.removeEventListener('pagehide', cleanup);
      supabase.removeChannel(ch);
      channelRef.current = null;
      cleanup();
    };
  }, [room.id, user.id]);

  // Stop a running countdown when leaving the room.
  useEffect(() => () => void runRef.current++, []);

  // Keep my presence up to date (name, camera, ready).
  useEffect(() => {
    if (conn === 'live') channelRef.current?.track({ name: userName, ready, camera: camera.status }).catch(() => {});
  }, [conn, ready, camera.status, userName]);

  // Partner left mid-session.
  useEffect(() => {
    if (!partner && RUNNING.includes(phaseRef.current)) abort('Your partner disconnected.');
    if (!partner) setRetake(null);
  }, [partner, abort]);

  // The host starts the session once both people are ready.
  useEffect(() => {
    if (role !== 'A' || phase === 'done' || RUNNING.includes(phase) || expired) return;
    if (!ready || !partner?.ready || camera.status !== 'ready' || partner.camera !== 'ready') return;
    const msg = { type: 'start', sid: newSessionId(), countdown: prefs.countdown || 3, settings };
    send(msg);
    runSession(msg);
  });

  // ----- Shared music -----
  useEffect(
    () =>
      music.subscribe((kind) => {
        if (kind === 'error') send({ type: 'music-error' });
        else send({ type: 'music', snap: music.snapshot(kind === 'track') });
      }),
    [music.subscribe, music.snapshot, send] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ----- Settings (either person can change them between sessions) -----
  const locked = RUNNING.includes(phase);
  const captionTimer = useRef(null);
  const updateSettings = (patch, { debounce = false } = {}) => {
    const next = { ...settings, ...patch };
    setSettingsState(next);
    clearTimeout(captionTimer.current);
    if (debounce) captionTimer.current = setTimeout(() => send({ type: 'settings', settings: next }), 500);
    else send({ type: 'settings', settings: next });
  };
  const upgrade = (title, description) => ent.openUpgrade({ feature: 'premium_templates', title, description });
  const chooseTemplate = (id) => {
    const t = getTemplate(id);
    if (!ent.canUseTemplate(t)) return upgrade(`Unlock “${t.name}”`, `${t.name} is a Premium template. Upgrade to use it — plus every other Premium look.`);
    updateSettings({ templateId: id, arrangementId: settings.arrangementId === 'scrapbook' && id !== 'miles-apart' ? 'alternate' : settings.arrangementId });
  };
  const chooseArrangement = (a) => {
    if (!ent.canUseLayout(a.layoutId)) return upgrade(`Unlock “${a.name}”`, 'This arrangement uses a Premium layout. Upgrade to unlock every layout.');
    if (a.templateId) {
      const t = getTemplate(a.templateId);
      if (!ent.canUseTemplate(t)) return upgrade(`Unlock “${t.name}”`, `${t.name} is a Premium template.`);
      return updateSettings({ arrangementId: a.id, templateId: a.templateId });
    }
    updateSettings({ arrangementId: a.id });
  };
  const chooseFilter = (id) => {
    if (!ent.canUseFilter(id)) {
      return ent.openUpgrade({ feature: 'premium_filters', title: `Unlock the ${FILTERS.find((f) => f.id === id).label} filter`, description: 'Upgrade to use every photo filter.' });
    }
    updateSettings({ filter: id });
  };
  const filterControl = (
    <SelectPill
      className="filter-select"
      icon="wand"
      label="Photo filter"
      value={settings.filter}
      onChange={chooseFilter}
      options={FILTERS.map((f) => ({ value: f.id, label: `${f.label}${ent.canUseFilter(f.id) ? '' : ' ✦ Premium'}` }))}
      disabled={locked}
    />
  );

  // ----- Export: same rules as the booth (each person's own plan & free strips) -----
  const gateRef = useRef(null);
  if (!gateRef.current) gateRef.current = createStripGate({ onUsage: ent.setStripUsage });
  const gate = gateRef.current;
  const [saved, setSaved] = useState(null);
  const [busyAction, setBusyAction] = useState(null);
  useEffect(() => setSaved(null), [photos, settings]);
  const complete = phase === 'done' && photos.every(Boolean);
  const hd = ent.canUseFeature('hd_export');
  const { stripUsage } = ent;
  const limitReached = !!stripUsage && !stripUsage.unlimited && stripUsage.used >= stripUsage.limit;

  const exportBlob = async (scale = 1) => {
    const canvas = await renderStrip(template, { photos, aspect: ASPECT, layout: plan.layout, caption: settings.caption, filter: settings.filter, scale });
    return { blob: await canvasToBlob(canvas, 'image/png'), width: canvas.width, height: canvas.height };
  };

  const withAction = (id, fn) => async () => {
    if (!complete) return toast.info('Not ready yet', 'Take your photos together first.');
    if (!ent.canUseTemplate(template) || !ent.canUseLayout(plan.layout.id)) {
      return upgrade('This strip uses a Premium look', 'Your partner picked a Premium template or layout. Upgrade to download or save it — or pick a free look and retake together.');
    }
    if (!ent.canUseFilter(settings.filter)) {
      return ent.openUpgrade({ feature: 'premium_filters', title: 'This strip uses a Premium filter', description: 'Upgrade to export it, or choose a free photo filter.' });
    }
    setBusyAction(id);
    try {
      const signature = compositionSignature({ photos, templateId: template.id, layoutId: plan.layout.id, filter: settings.filter, aspect: ASPECT });
      const res = await gate.authorizeExport(signature, { template: template.id, layout: plan.layout.id });
      if (!res.allowed) {
        ent.openUpgrade({ feature: 'unlimited_strips', title: `You’ve reached your ${FREE_STRIP_LIMIT} free photostrips`, description: 'Upgrade to Premium to create unlimited photostrips.' });
        return;
      }
      await fn();
    } catch (err) {
      toast.error('Something went wrong', err.message);
    } finally {
      setBusyAction(null);
    }
  };

  const download = withAction('download', async () => {
    const { blob } = await exportBlob(hd ? 2 : 1);
    downloadBlob(blob, stripFileName(template.name));
    track('photostrip_downloaded', { template: template.id, layout: plan.layout.id, source: 'ldr', hd });
    toast.success(hd ? 'Downloaded in HD!' : 'Downloaded!', 'Your shared strip was saved to your device.');
  });

  const share = withAction('share', async () => {
    const { blob } = await exportBlob();
    const res = await shareBlob(blob, stripFileName(template.name));
    if (res === 'downloaded') toast.info('Sharing isn’t supported here', 'We downloaded the strip so you can share it.');
  });

  const save = withAction('save', async () => {
    if (saved) return toast.info('Already saved', 'This strip is in My Photos.');
    const creationId = gate.state.id;
    if (strips.strips.some((x) => x.creationId && x.creationId === creationId)) {
      setSaved(true);
      return toast.info('Already in My Photos', 'This strip is saved — find it in your gallery.');
    }
    const { blob, width, height } = await exportBlob();
    try {
      await strips.save({ blob, width, height, templateId: template.id, templateName: template.name, layoutId: plan.layout.id, favorite: false, creationId });
    } catch (err) {
      if (/strips_creation_unique/i.test(err.message)) {
        await strips.reload();
        setSaved(true);
        return toast.info('Already in My Photos', 'This strip is saved — find it in your gallery.');
      }
      if (/premium_required/i.test(err.message)) return upgrade('Saving this strip needs Premium', 'This strip uses a Premium template or layout.');
      if (/creation_required|strip_limit_reached/i.test(err.message)) {
        return ent.openUpgrade({ feature: 'unlimited_strips', title: `You’ve reached your ${FREE_STRIP_LIMIT} free photostrips`, description: 'Upgrade to Premium to create unlimited photostrips.' });
      }
      throw err;
    }
    setSaved(true);
    track('photostrip_saved', { template: template.id, layout: plan.layout.id, favorite: false });
    toast.success('Saved to My Photos', 'Find it any time in your gallery.');
  });

  const print = withAction('print', async () => {
    const { blob } = await exportBlob();
    printBlob(blob);
  });

  const actions = [
    { id: 'download', label: 'Download', icon: 'download', onClick: download, disabled: !complete },
    { id: 'save', label: saved ? 'Saved' : 'Save', icon: saved ? 'check' : 'save', onClick: save, disabled: !complete },
    { id: 'share', label: 'Share', icon: 'share', onClick: share, disabled: !complete },
    { id: 'print', label: 'Print', icon: 'printer', onClick: print, disabled: !complete },
  ];

  // ----- Invite -----
  const link = inviteLink(room.code);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Invite link copied', 'Send it to your partner.');
    } catch {
      toast.info('Copy this link', link);
    }
  };
  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join my PhotoBooth room 💞', text: `Let’s take photos together! Room code ${room.code}`, url: link });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    copyLink();
  };

  const requestRetake = () => {
    if (!partner) return toast.info('Your partner isn’t here', 'Retakes need both of you in the room.');
    setRetake('sent');
    send({ type: 'retake-request' });
  };
  const answerRetake = (ok) => {
    send({ type: 'retake-reply', ok });
    setRetake(null);
    if (ok) resetForRetake();
  };

  // ----- View -----
  const partnerLabel = partner ? partner.name : hadPartner ? 'Partner disconnected' : 'Waiting for your partner…';
  const cameraOk = camera.status === 'ready';
  const canReady = conn === 'live' && cameraOk && !!partner && !expired && !locked && phase !== 'done';
  const statusLine = expired
    ? 'This room has expired.'
    : conn === 'error'
      ? 'Connection problem — trying to reconnect…'
      : !partner
        ? hadPartner
          ? 'Your partner left or lost connection. They can rejoin with the same link.'
          : 'Waiting for your partner… send them the invite link.'
        : partner.camera !== 'ready'
          ? `${partner.name}’s camera isn’t ready yet.`
          : phase === 'waiting'
            ? `Waiting for ${partner.name}’s photos…`
            : locked
              ? 'Smile! You’re both in the shot.'
              : ready && !partner.ready
                ? `You’re ready — waiting for ${partner.name}.`
                : !ready && partner.ready
                  ? `${partner.name} is ready — tap “I’m ready”.`
                  : phase === 'done'
                    ? complete ? 'Your shared strip is ready!' : 'Retake together to fill this arrangement.'
                    : 'Tap “I’m ready” when you’re both set. The countdown starts together.';

  return (
    <div className="booth ldr">
      <header className="booth-header">
        <div className="booth-header-left">
          <Logo to="/dashboard" />
        </div>
        <div className="booth-header-right">
          <span className={`status-pill status-${conn === 'live' ? 'ready' : conn === 'error' ? 'error' : 'loading'}`} role="status">
            <i aria-hidden="true" />
            {conn === 'live' ? 'Connected' : conn === 'error' ? 'Reconnecting…' : 'Connecting…'}
          </span>
          <Button size="sm" variant="ghost" icon="arrow-left" onClick={onLeave}>
            Leave
          </Button>
        </div>
      </header>

      <main id="main" className="ldr-grid page-enter">
        <section className="camera-card card" aria-label="Your camera">
          <CameraPreview
            camera={camera}
            aspect={ASPECT}
            mirror={prefs.mirror}
            countdown={count}
            shotLabel={`Photo ${round + 1} of ${plan.rounds} — smile together!`}
            flashing={flash}
          />
          <p className="ldr-status" role="status" aria-live="polite">
            {statusLine}
          </p>
          <div className="camera-actions">
            {phase === 'done' ? (
              <Button size="xl" icon="refresh" onClick={requestRetake} disabled={retake === 'sent' || !partner} className="take-btn">
                {retake === 'sent' ? 'Asked your partner…' : 'Retake together'}
              </Button>
            ) : locked ? (
              <Button size="xl" variant="outline" icon="x" onClick={() => abort('You stopped the session.', { notify: true })}>
                Stop
              </Button>
            ) : (
              <Button size="xl" icon={ready ? 'check' : 'camera'} className={`take-btn${ready ? ' is-busy' : ''}`} onClick={() => setReady((r) => !r)} disabled={!canReady}>
                {ready ? 'Ready! (tap to cancel)' : 'I’m ready'}
              </Button>
            )}
          </div>
          {stripUsage && !stripUsage.unlimited && (
            <div className={`strip-usage${limitReached ? ' is-full' : ''}`} role="status">
              <span className="strip-usage-count">
                {Math.min(stripUsage.used, stripUsage.limit)} / {stripUsage.limit} Free Strips Used
              </span>
              {limitReached && <p>You can still take photos together — downloading or saving a new strip needs Premium.</p>}
            </div>
          )}
        </section>

        <div className="booth-side ldr-side">
          <section className="card ldr-room" aria-label="Room">
            <div className="ldr-people">
              <div className="ldr-person">
                <Avatar user={user} size={40} />
                <div>
                  <strong>You</strong>
                  <small className={cameraOk ? 'ok' : ''}>{cameraOk ? (ready ? 'Ready' : 'Camera on') : 'Camera off'}</small>
                </div>
              </div>
              <span className="ldr-link-heart" aria-hidden="true">♥</span>
              <div className={`ldr-person${partner ? '' : ' is-away'}`}>
                <Avatar user={partner ? { name: partner.name } : null} size={40} />
                <div>
                  <strong>{partnerLabel}</strong>
                  {partner && <small className={partner.camera === 'ready' ? 'ok' : ''}>{partner.camera === 'ready' ? (partner.ready ? 'Ready' : 'Camera on') : 'Camera off'}</small>}
                </div>
              </div>
            </div>
            <div className="ldr-invite">
              <div>
                <small>Room code</small>
                <strong className="ldr-code">{room.code}</strong>
              </div>
              <Button size="sm" variant="outline" icon="copy" onClick={copyLink}>
                Copy link
              </Button>
              <Button size="sm" variant="outline" icon="share" onClick={shareLink}>
                Invite
              </Button>
            </div>
            <small className="ldr-fine">{expired ? 'Expired' : `Room closes in ${minutesLeft >= 60 ? `${Math.floor(minutesLeft / 60)} h ${minutesLeft % 60} min` : `${minutesLeft} min`}`}</small>
          </section>

          <section className="card ldr-settings" aria-label="Strip settings">
            <h2>Arrangement</h2>
            <div className="ldr-arrangements" role="group" aria-label="Arrangement">
              {LDR_ARRANGEMENTS.map((a) => (
                <button key={a.id} type="button" aria-pressed={settings.arrangementId === a.id} disabled={locked} onClick={() => chooseArrangement(a)}>
                  <strong>{a.name}</strong>
                  <small>{a.hint}</small>
                  {!ent.canUseLayout(a.layoutId) || (a.templateId && !ent.canUseTemplate(getTemplate(a.templateId))) ? <Icon name="lock" size={12} /> : null}
                </button>
              ))}
            </div>
            {filterControl}
            <label className="ldr-caption">
              <span>Caption</span>
              <input
                className="input"
                maxLength={40}
                value={settings.caption}
                disabled={locked}
                placeholder={template.texts?.find((t) => t.caption)?.text || 'Shown on templates with a caption'}
                onChange={(e) => updateSettings({ caption: e.target.value }, { debounce: true })}
              />
            </label>
          </section>

          <MusicThemeHint templateId={settings.templateId} onUse={chooseTemplate} />
          <TemplateSelector value={settings.templateId} onChange={locked ? () => {} : chooseTemplate} aspect={ASPECT} layout={plan.layout} favorites={prefs.favoriteTemplates} />
          <StripPreview template={template} layout={plan.layout} photos={photos} aspect={ASPECT} caption={settings.caption} filter={settings.filter} actions={actions} busyAction={busyAction} />
        </div>
      </main>

      {flash && <div className="screen-flash" aria-hidden="true" />}
      <MusicPlayer shared={!!partner} />

      <Modal open={retake === 'received'} onClose={() => answerRetake(false)} width={420} title="Retake together?">
        <p className="muted">{partner?.name || 'Your partner'} wants to take the photos again. The countdown starts as soon as you both agree.</p>
        <div className="result-actions">
          <Button icon="refresh" block onClick={() => answerRetake(true)} data-autofocus>
            Yes, retake
          </Button>
          <Button variant="ghost" block onClick={() => answerRetake(false)}>
            Keep these photos
          </Button>
        </div>
      </Modal>

      <Modal open={resultOpen} onClose={() => setResultOpen(false)} width={520} className="result-modal">
        <div className="result">
          <div className="result-strip">
            <ResultImage template={template} photos={photos} layout={plan.layout} caption={settings.caption} filter={settings.filter} />
          </div>
          <div className="result-body">
            <span className="badge">
              <Icon name="sparkle" size={12} /> {template.name}
            </span>
            <h2 className="result-title">
              Together, from miles apart <span aria-hidden="true">💞</span>
            </h2>
            <p className="muted">You both have this strip. Download it, keep it in My Photos, or retake together.</p>
            {filterControl}
            <div className="result-actions">
              <Button icon="download" block onClick={download} loading={busyAction === 'download'} disabled={!!busyAction} data-autofocus>
                Download
              </Button>
              <Button variant="outline" icon={saved ? 'check' : 'save'} block onClick={save} loading={busyAction === 'save'} disabled={!!busyAction}>
                {saved ? 'Saved to My Photos' : 'Save to My Photos'}
              </Button>
              <Button variant="outline" icon="printer" block onClick={print} loading={busyAction === 'print'} disabled={!!busyAction || !complete}>
                Print
              </Button>
              <Button variant="ghost" icon="refresh" block onClick={requestRetake} disabled={!!busyAction || retake === 'sent'}>
                {retake === 'sent' ? 'Asked your partner…' : 'Retake together'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ResultImage({ template, photos, layout, caption, filter }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    renderStrip(template, { photos, aspect: ASPECT, layout, caption, filter, scale: 0.6 }).then((c) => alive && setUrl(c.toDataURL('image/jpeg', 0.9)));
    return () => {
      alive = false;
    };
  }, [template, photos, layout, caption, filter]);
  return url ? <img src={url} alt={`Your shared ${template.name} strip`} className="strip-img" /> : null;
}
