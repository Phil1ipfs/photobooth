import React, { useState } from 'react';
import AuthLayout from '../components/auth/AuthLayout';
import LoginForm, { LoginFooter } from '../components/auth/LoginForm';
import SignupForm from '../components/auth/SignupForm';
import Icon from '../components/common/Icon';
import Button from '../components/common/Button';
import { PasswordInput } from '../components/common/Input';
import { Link, Redirect, useRouter } from '../lib/router';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { firstName } from '../lib/format';
import { PASSWORD_RULES, validateNewPassword } from '../lib/validation';

// Only allow internal redirects.
const safeNext = (next) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard');

function NotConfiguredNotice() {
  const { configured } = useAuth();
  if (configured) return null;
  return (
    <div className="form-alert" role="alert">
      <Icon name="alert" size={18} />
      Accounts are temporarily unavailable. You can still use the photobooth and download your strips.
    </div>
  );
}

export function LoginPage() {
  const { query, navigate } = useRouter();
  const toast = useToast();
  const next = query.get('next');
  return (
    <AuthLayout title="Welcome Back!" subtitle="Log in to continue capturing your moments." footer={<LoginFooter next={next} />}>
      <NotConfiguredNotice />
      <LoginForm
        next={safeNext(next)}
        onSuccess={(user) => {
          toast.success(`Welcome back, ${firstName(user.name)}!`, 'Ready to make some memories?');
          navigate(safeNext(next), { replace: true });
        }}
      />
    </AuthLayout>
  );
}

export function SignupPage() {
  const { query, navigate } = useRouter();
  const next = query.get('next');
  const { user } = useAuth();
  const [result, setResult] = useState(null);

  if (user && !result) return <Redirect to="/dashboard" />;

  if (result?.needsConfirmation) {
    return (
      <AuthLayout title="Check your email" subtitle="One last step to activate your account.">
        <div className="auth-success" role="status">
          <span className="auth-success-icon">
            <Icon name="mail" size={28} strokeWidth={2} />
          </span>
          <p className="muted">
            We sent a confirmation link to <strong>{result.email}</strong>. Open it on this device to finish signing up —
            then you’ll be logged in automatically.
          </p>
          <Button variant="outline" block to="/login">
            Back to Log In
          </Button>
          <Button variant="ghost" block to="/booth">
            Use the Photobooth meanwhile
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (result?.user) {
    return (
      <AuthLayout title="You’re all set!" subtitle={`Welcome to PhotoBooth, ${firstName(result.user.name)}.`}>
        <div className="auth-success" role="status">
          <span className="auth-success-icon">
            <Icon name="check" size={30} strokeWidth={2.4} />
          </span>
          <p className="muted">Your account has been created. Your strips are saved to your account and available on any device.</p>
          <Button size="lg" block iconRight="arrow-right" onClick={() => navigate(safeNext(next), { replace: true })} data-autofocus>
            {next === '/booth' ? 'Back to the Photobooth' : 'Go to my Dashboard'}
          </Button>
          <Button variant="ghost" block to="/booth">
            Open Photobooth
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create Your Account"
      subtitle="Join us and start making memories today!"
      footer={
        <>
          Already have an account? <Link to={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`}>Log In</Link>
        </>
      }
    >
      <NotConfiguredNotice />
      <SignupForm next={safeNext(next)} onSuccess={setResult} />
    </AuthLayout>
  );
}

/** Landing page for the emailed "reset your password" link. */
export function ResetPasswordPage() {
  const { user, ready, recovering, setNewPassword } = useAuth();
  const { navigate } = useRouter();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const er = { password: validateNewPassword(password), confirm: confirm !== password ? 'Passwords don’t match.' : '' };
    Object.keys(er).forEach((k) => !er[k] && delete er[k]);
    setErrors(er);
    if (Object.keys(er).length) return;
    setLoading(true);
    try {
      await setNewPassword(password);
      toast.success('Password updated', 'You’re logged in with your new password.');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setErrors({ [err.field || 'password']: err.message });
      setLoading(false);
    }
  };

  // The recovery link signs the user in; without it there's nothing to reset.
  if (ready && !user && !recovering) {
    return (
      <AuthLayout title="Link expired" subtitle="This password reset link is invalid or has expired.">
        <div className="auth-success">
          <p className="muted">Request a new link from the log in page.</p>
          <Button block to="/login">
            Back to Log In
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set a new password" subtitle="Choose a new password for your account.">
      <form className="auth-form" onSubmit={submit} noValidate>
        <PasswordInput
          label="New password"
          hideLabel
          placeholder="New password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint={PASSWORD_RULES.map((r) => r.label).join(' · ')}
          autoFocus
        />
        <PasswordInput
          label="Confirm new password"
          hideLabel
          placeholder="Confirm new password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={errors.confirm}
        />
        <Button type="submit" size="lg" block loading={loading} disabled={!ready}>
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
}
