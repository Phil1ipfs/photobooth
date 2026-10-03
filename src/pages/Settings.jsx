import React, { useRef, useState } from 'react';
import AppLayout, { PageHeader } from '../components/layout/AppLayout';
import Button from '../components/common/Button';
import Icon from '../components/common/Icon';
import Modal from '../components/common/Modal';
import Input, { PasswordInput, SelectPill } from '../components/common/Input';
import { Avatar } from '../components/common/misc';
import { COUNTDOWNS } from '../components/photobooth/CameraControls';
import { useAuth } from '../context/AuthContext';
import { usePrefs } from '../context/PrefsContext';
import { useToast } from '../context/ToastContext';
import { useRouter } from '../lib/router';
import { fileToAvatar } from '../lib/share';
import { PASSWORD_RULES, passwordIssues, validateEmail, validateName } from '../lib/validation';
import { ASPECTS, LAYOUTS } from '../templates/data';

function Section({ id, title, description, children }) {
  return (
    <section className="settings-section card" aria-labelledby={id}>
      <div className="settings-section-head">
        <h2 id={id}>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      <div className="settings-section-body">{children}</div>
    </section>
  );
}

function Row({ label, hint, htmlFor, children }) {
  return (
    <div className="settings-row">
      <div className="settings-row-label">
        {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <span>{label}</span>}
        {hint && <small>{hint}</small>}
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  );
}

function ProfileSection() {
  const { user, updateProfile } = useAuth();
  const toast = useToast();
  const fileRef = useRef(null);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const dirty = name !== user.name || email !== user.email;

  const save = async (e) => {
    e.preventDefault();
    const er = { name: validateName(name), email: validateEmail(email) };
    Object.keys(er).forEach((k) => !er[k] && delete er[k]);
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    try {
      const { emailChangePending } = await updateProfile({ name, email });
      if (emailChangePending) {
        toast.info('Confirm your new email', `We sent a link to ${email.trim()}. Your email changes once you click it.`);
      } else {
        toast.success('Profile updated');
      }
    } catch (err) {
      if (err.field) setErrors({ [err.field]: err.message });
      else toast.error('Couldn’t save profile', err.message);
    } finally {
      setSaving(false);
    }
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      await updateProfile({ avatar: await fileToAvatar(file) });
      toast.success('Profile picture updated');
    } catch (err) {
      toast.error('Couldn’t update picture', err.message);
    }
  };

  return (
    <Section id="profile" title="Profile" description="How you appear across PhotoBooth.">
      <div className="avatar-row">
        <Avatar user={user} size={76} />
        <div className="avatar-row-actions">
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
          <Button size="sm" variant="outline" icon="upload" onClick={() => fileRef.current?.click()}>
            Upload photo
          </Button>
          {user.avatar && (
            <Button size="sm" variant="ghost" onClick={() => updateProfile({ avatar: null })}>
              Remove
            </Button>
          )}
          <small className="muted">JPG or PNG, cropped to a square.</small>
        </div>
      </div>
      <form className="settings-form" onSubmit={save} noValidate>
        <Input label="Name" icon="user" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoComplete="name" />
        <Input
          label="Email"
          icon="mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          autoComplete="email"
        />
        <div className="settings-form-actions">
          <Button type="submit" loading={saving} disabled={!dirty}>
            Save changes
          </Button>
        </div>
      </form>
    </Section>
  );
}

function PreferencesSection() {
  const { prefs, setPref } = usePrefs();
  const themes = [
    { id: 'light', label: 'Light', icon: 'sun' },
    { id: 'dark', label: 'Dark', icon: 'moon' },
    { id: 'system', label: 'System', icon: 'monitor' },
  ];
  return (
    <Section id="prefs" title="Preferences" description="Saved automatically on this device.">
      <Row label="Theme" hint="Choose how PhotoBooth looks.">
        <div className="segmented" role="group" aria-label="Theme">
          {themes.map((t) => (
            <button key={t.id} aria-pressed={prefs.theme === t.id} onClick={() => setPref({ theme: t.id })}>
              <Icon name={t.icon} size={15} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />
              {t.label}
            </button>
          ))}
        </div>
      </Row>
      <Row label="Sound effects" hint="Countdown beeps and shutter sound." htmlFor="pref-sound">
        <input id="pref-sound" type="checkbox" role="switch" className="switch" checked={prefs.sound} onChange={(e) => setPref({ sound: e.target.checked })} />
      </Row>
      <Row label="Mirror camera" hint="Show and save photos like a mirror." htmlFor="pref-mirror">
        <input id="pref-mirror" type="checkbox" role="switch" className="switch" checked={prefs.mirror} onChange={(e) => setPref({ mirror: e.target.checked })} />
      </Row>
      <Row label="Screen flash" hint="Brighten the screen when a photo is taken." htmlFor="pref-flash">
        <input id="pref-flash" type="checkbox" role="switch" className="switch" checked={prefs.flash} onChange={(e) => setPref({ flash: e.target.checked })} />
      </Row>
      <Row label="Default countdown">
        <SelectPill icon="timer" label="Default countdown" value={String(prefs.countdown)} onChange={(v) => setPref({ countdown: Number(v) })} options={COUNTDOWNS} />
      </Row>
      <Row label="Default aspect ratio">
        <SelectPill
          icon="aspect"
          label="Default aspect ratio"
          value={prefs.aspect}
          onChange={(v) => setPref({ aspect: v })}
          options={ASPECTS.map((a) => ({ value: a.id, label: a.label }))}
        />
      </Row>
      <Row label="Default photo layout" hint="How many photos, and how they’re arranged.">
        <SelectPill
          icon="templates"
          label="Default photo layout"
          value={prefs.layout}
          onChange={(v) => setPref({ layout: v })}
          options={LAYOUTS.map((l) => ({ value: l.id, label: `${l.label} — ${l.name}` }))}
        />
      </Row>
      <Row label="Capture mode" hint="Auto fills every empty slot in one go.">
        <SelectPill
          icon="layers"
          label="Capture mode"
          value={prefs.captureMode}
          onChange={(v) => setPref({ captureMode: v })}
          options={[
            { value: 'auto', label: 'Auto (fill all)' },
            { value: 'single', label: 'One shot' },
          ]}
        />
      </Row>
    </Section>
  );
}

function AccountSection() {
  const { changePassword, deleteAccount, logOut } = useAuth();
  const toast = useToast();
  const { navigate } = useRouter();
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwErrors, setPwErrors] = useState({});
  const [pwSaving, setPwSaving] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [delPw, setDelPw] = useState('');
  const [delError, setDelError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const setField = (k) => (e) => {
    setPw((s) => ({ ...s, [k]: e.target.value }));
    setPwErrors((er) => ({ ...er, [k]: '' }));
  };

  const submitPw = async (e) => {
    e.preventDefault();
    const er = {};
    if (!pw.current) er.current = 'Enter your current password.';
    if (passwordIssues(pw.next).length) er.next = `New password needs: ${passwordIssues(pw.next).map((r) => r.label.toLowerCase()).join(', ')}.`;
    if (pw.confirm !== pw.next) er.confirm = 'Passwords don’t match.';
    setPwErrors(er);
    if (Object.keys(er).length) return;
    setPwSaving(true);
    try {
      await changePassword(pw.current, pw.next);
      setPw({ current: '', next: '', confirm: '' });
      toast.success('Password changed');
    } catch (err) {
      if (err.field) setPwErrors({ [err.field]: err.message });
      else toast.error('Couldn’t change password', err.message);
    } finally {
      setPwSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!delPw) {
      setDelError('Enter your password to confirm.');
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount(delPw);
      toast.info('Account deleted', 'Your account and all saved strips were permanently deleted.');
      navigate('/', { replace: true });
    } catch (err) {
      setDelError(err.message);
      setDeleting(false);
    }
  };

  return (
    <Section id="account" title="Account" description="Security and account management.">
      <form className="settings-form" onSubmit={submitPw} noValidate>
        <h3 className="settings-sub">Change password</h3>
        <PasswordInput label="Current password" value={pw.current} onChange={setField('current')} error={pwErrors.current} autoComplete="current-password" />
        <PasswordInput
          label="New password"
          value={pw.next}
          onChange={setField('next')}
          error={pwErrors.next}
          autoComplete="new-password"
          hint={PASSWORD_RULES.map((r) => r.label).join(' · ')}
        />
        <PasswordInput label="Confirm new password" value={pw.confirm} onChange={setField('confirm')} error={pwErrors.confirm} autoComplete="new-password" />
        <div className="settings-form-actions">
          <Button type="submit" variant="outline" loading={pwSaving}>
            Update password
          </Button>
        </div>
      </form>

      <div className="settings-danger">
        <div>
          <strong>Log out</strong>
          <small>End your session on this device.</small>
        </div>
        <Button
          variant="outline"
          icon="logout"
          onClick={() => {
            logOut();
            toast.info('Logged out', 'See you soon ♡');
            navigate('/');
          }}
        >
          Log Out
        </Button>
      </div>
      <div className="settings-danger danger">
        <div>
          <strong>Delete account</strong>
          <small>Permanently remove your account and all saved strips.</small>
        </div>
        <Button variant="danger" icon="trash" onClick={() => setDelOpen(true)}>
          Delete account
        </Button>
      </div>

      <Modal
        open={delOpen}
        onClose={() => {
          setDelOpen(false);
          setDelPw('');
          setDelError('');
        }}
        title="Delete your account?"
        description="This permanently deletes your account, preferences and every saved strip. This can’t be undone."
        width={440}
      >
        <form
          className="settings-form"
          onSubmit={(e) => {
            e.preventDefault();
            confirmDelete();
          }}
        >
          <PasswordInput
            label="Confirm with your password"
            value={delPw}
            onChange={(e) => {
              setDelPw(e.target.value);
              setDelError('');
            }}
            error={delError}
            autoComplete="current-password"
            data-autofocus
          />
          <div className="modal-actions">
            <Button variant="ghost" onClick={() => setDelOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={deleting}>
              Delete forever
            </Button>
          </div>
        </form>
      </Modal>
    </Section>
  );
}

export default function Settings() {
  return (
    <AppLayout>
      <PageHeader title="Settings" subtitle="Manage your profile, preferences and account." />
      <div className="settings-stack">
        <ProfileSection />
        <PreferencesSection />
        <AccountSection />
      </div>
    </AppLayout>
  );
}
