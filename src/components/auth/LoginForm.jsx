import React, { useState } from 'react';
import Input, { PasswordInput } from '../common/Input';
import Button from '../common/Button';
import Icon from '../common/Icon';
import Modal from '../common/Modal';
import SocialButtons from './SocialButtons';
import { Link } from '../../lib/router';
import { useAuth } from '../../context/AuthContext';

function ForgotPasswordModal({ open, onClose, initialEmail }) {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const close = () => {
    onClose();
    setTimeout(() => {
      setSent(false);
      setError('');
    }, 250);
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title={sent ? 'Check your email' : 'Forgot your password?'} width={440}>
      {sent ? (
        <>
          <p className="muted">
            If an account exists for <strong>{email}</strong>, we’ve sent a link to reset your password. It may take a
            minute to arrive — check your spam folder too.
          </p>
          <div className="modal-actions">
            <Button onClick={close} data-autofocus>
              Done
            </Button>
          </div>
        </>
      ) : (
        <form onSubmit={submit} noValidate>
          <p className="muted" style={{ marginBottom: 16 }}>
            Enter the email you signed up with and we’ll send you a link to choose a new password.
          </p>
          <Input
            label="Email address"
            hideLabel
            icon="mail"
            type="email"
            placeholder="Email address"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError('');
            }}
            error={error}
            data-autofocus
          />
          <div className="modal-actions">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" loading={loading} icon="mail">
              Send reset link
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default function LoginForm({ onSuccess, next }) {
  const { logIn } = useAuth();
  const [values, setValues] = useState({ identifier: '', password: '', remember: true });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const set = (key) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setValues((s) => ({ ...s, [key]: v }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: '' }));
    setFormError('');
  };

  const validate = () => {
    const er = {};
    if (!values.identifier.trim()) er.identifier = 'Please enter your email address.';
    if (!values.password) er.password = 'Please enter your password.';
    setErrors(er);
    return !Object.keys(er).length;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (loading || !validate()) return;
    setLoading(true);
    try {
      const user = await logIn(values);
      onSuccess(user);
    } catch (err) {
      if (err.field) setErrors({ [err.field]: err.message });
      else setFormError(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <>
      <form className="auth-form" onSubmit={submit} noValidate>
        {formError && (
          <div className="form-alert" role="alert">
            <Icon name="alert" size={18} />
            {formError}
          </div>
        )}
        <Input
          label="Email address"
          hideLabel
          icon="mail"
          type="email"
          placeholder="Email address"
          autoComplete="email"
          value={values.identifier}
          onChange={set('identifier')}
          error={errors.identifier}
          autoFocus
        />
        <PasswordInput
          label="Password"
          hideLabel
          placeholder="Password"
          autoComplete="current-password"
          value={values.password}
          onChange={set('password')}
          error={errors.password}
        />
        <div className="auth-row">
          <label className="check">
            <input type="checkbox" checked={values.remember} onChange={set('remember')} />
            Remember me
          </label>
          <button type="button" className="link-btn" onClick={() => setForgotOpen(true)}>
            Forgot password?
          </button>
        </div>
        <Button type="submit" size="lg" block loading={loading} iconRight="arrow-right">
          {loading ? 'Logging in…' : 'Log In'}
        </Button>
      </form>
      <SocialButtons next={next} />

      <ForgotPasswordModal
        key={forgotOpen ? 'open' : 'closed'}
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        initialEmail={values.identifier.trim()}
      />
    </>
  );
}

export function LoginFooter({ next }) {
  return (
    <>
      Don’t have an account? <Link to={`/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`}>Sign Up</Link>
    </>
  );
}
