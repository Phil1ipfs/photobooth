import React, { useState } from 'react';
import Input, { PasswordInput } from '../common/Input';
import Button from '../common/Button';
import Icon from '../common/Icon';
import Modal from '../common/Modal';
import SocialButtons from './SocialButtons';
import { Link } from '../../lib/router';
import { useAuth } from '../../context/AuthContext';

export default function LoginForm({ onSuccess }) {
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
    if (!values.identifier.trim()) er.identifier = 'Please enter your email or username.';
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
          label="Email or Username"
          hideLabel
          icon="user"
          placeholder="Email or Username"
          autoComplete="username"
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
      <SocialButtons />

      <Modal open={forgotOpen} onClose={() => setForgotOpen(false)} title="Forgot your password?" width={440}>
        <p className="muted">
          PhotoBooth accounts are stored securely on this device, so we can’t email a reset link. If you’re still logged in
          on another tab, you can change your password in <strong>Settings</strong>. Otherwise you can create a new account.
        </p>
        <div className="modal-actions">
          <Button variant="ghost" onClick={() => setForgotOpen(false)}>
            Back to log in
          </Button>
          <Button to="/signup">Create account</Button>
        </div>
      </Modal>
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
