import React from 'react';
import Logo from '../common/Logo';
import { AuthGarden, AuthTopDecor } from './AuthArtwork';

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth-page">
      <a href="#main" className="skip-link">Skip to account form</a>
      <main id="main" className="auth-card card page-enter">
        <AuthTopDecor />
        <div className="auth-content">
          <div className="auth-logo">
            <Logo />
          </div>
          <h1 className="auth-title">{title}</h1>
          <p className="auth-subtitle">{subtitle}</p>
          {children}
          {footer && <p className="auth-footer">{footer}</p>}
        </div>
        <AuthGarden />
      </main>
    </div>
  );
}
