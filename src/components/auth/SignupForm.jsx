import React, { useState } from 'react';
import Input, { PasswordInput } from '../common/Input';
import Button from '../common/Button';
import Icon from '../common/Icon';
import SocialButtons from './SocialButtons';
import { useAuth } from '../../context/AuthContext';
import { PASSWORD_RULES, validateEmail, validateName, validateNewPassword } from '../../lib/validation';

export default function SignupForm({ onSuccess }) {
  const { signUp } = useAuth();
  const [values, setValues] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [touchedPw, setTouchedPw] = useState(false);

  const set = (key) => (e) => {
    setValues((s) => ({ ...s, [key]: e.target.value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: '' }));
    if (key === 'password') setTouchedPw(true);
    setFormError('');
  };

  const validate = () => {
    const er = {
      name: validateName(values.name),
      email: validateEmail(values.email),
      password: validateNewPassword(values.password),
      confirm: !values.confirm
        ? 'Please confirm your password.'
        : values.confirm !== values.password
          ? 'Passwords don’t match.'
          : '',
    };
    Object.keys(er).forEach((k) => !er[k] && delete er[k]);
    setErrors(er);
    setTouchedPw(true);
    return !Object.keys(er).length;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (loading || !validate()) return;
    setLoading(true);
    try {
      const user = await signUp(values);
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
          label="Full Name"
          hideLabel
          icon="user"
          placeholder="Full Name"
          autoComplete="name"
          value={values.name}
          onChange={set('name')}
          error={errors.name}
          autoFocus
        />
        <Input
          label="Email Address"
          hideLabel
          icon="mail"
          type="email"
          placeholder="Email Address"
          autoComplete="email"
          value={values.email}
          onChange={set('email')}
          error={errors.email}
        />
        <PasswordInput
          label="Password"
          hideLabel
          placeholder="Password"
          autoComplete="new-password"
          value={values.password}
          onChange={set('password')}
          error={errors.password}
          aria-describedby="pw-rules"
        />
        <ul className={`pw-rules${touchedPw ? ' show' : ''}`} id="pw-rules" aria-label="Password requirements">
          {PASSWORD_RULES.map((r) => {
            const ok = r.test(values.password);
            return (
              <li key={r.id} className={ok ? 'ok' : ''}>
                <Icon name={ok ? 'check-circle' : 'alert'} size={14} />
                {r.label}
                <span className="sr-only">{ok ? ' — met' : ' — not met'}</span>
              </li>
            );
          })}
        </ul>
        <PasswordInput
          label="Confirm Password"
          hideLabel
          placeholder="Confirm Password"
          autoComplete="new-password"
          value={values.confirm}
          onChange={set('confirm')}
          error={errors.confirm}
        />
        <Button type="submit" size="lg" block loading={loading} iconRight="arrow-right">
          {loading ? 'Creating account…' : 'Sign Up'}
        </Button>
      </form>
      <SocialButtons />
    </>
  );
}
