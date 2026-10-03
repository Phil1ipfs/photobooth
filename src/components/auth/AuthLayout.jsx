import React from 'react';
import Logo from '../common/Logo';
import { Sparkle, DoodleHeart, HeartSwirl } from '../common/misc';
import { LogoMark } from '../common/Logo';

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth-page">
      <div className="auth-blob auth-blob-1" aria-hidden="true" />
      <div className="auth-blob auth-blob-2" aria-hidden="true" />
      <main id="main" className="auth-card card page-enter">
        <Sparkle size={22} className="deco-twinkle" style={{ left: 28, top: 34 }} />
        <Sparkle size={12} className="deco-twinkle" style={{ left: 58, top: 70, animationDelay: '0.8s' }} />
        <span className="deco auth-camera-doodle" aria-hidden="true">
          <LogoMark size={34} />
        </span>
        <HeartSwirl size={70} className="auth-swirl" />
        <DoodleHeart size={42} className="auth-heart" />
        <Sparkle size={14} className="deco-twinkle" style={{ right: 30, bottom: 60, animationDelay: '1.6s' }} />

        <div className="auth-logo">
          <Logo />
        </div>
        <h1 className="auth-title">{title}</h1>
        <p className="auth-subtitle">{subtitle}</p>
        {children}
        {footer && <p className="auth-footer">{footer}</p>}
      </main>
    </div>
  );
}
