import React, { useState } from 'react';
import AuthLayout from '../components/auth/AuthLayout';
import LoginForm, { LoginFooter } from '../components/auth/LoginForm';
import SignupForm from '../components/auth/SignupForm';
import Icon from '../components/common/Icon';
import Button from '../components/common/Button';
import { Link, Redirect, useRouter } from '../lib/router';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { firstName } from '../lib/format';

// Only allow internal redirects.
const safeNext = (next) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard');

export function LoginPage() {
  const { query, navigate } = useRouter();
  const toast = useToast();
  const next = query.get('next');
  return (
    <AuthLayout
      title="Welcome Back!"
      subtitle="Log in to continue capturing your moments."
      footer={<LoginFooter next={next} />}
    >
      <LoginForm
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
  const [created, setCreated] = useState(null);

  if (user && !created) return <Redirect to="/dashboard" />;

  if (created) {
    return (
      <AuthLayout title="You’re all set!" subtitle={`Welcome to PhotoBooth, ${firstName(created.name)}.`}>
        <div className="auth-success" role="status">
          <span className="auth-success-icon">
            <Icon name="check" size={30} strokeWidth={2.4} />
          </span>
          <p className="muted">Your account has been created. Your strips and favorites will now be saved to My Photos.</p>
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
      <SignupForm onSuccess={setCreated} />
    </AuthLayout>
  );
}
