import React from 'react';
import Logo from '../common/Logo';
import Icon from '../common/Icon';
import { Link } from '../../lib/router';
import { MARKETING_NAV } from './Header';
import { SOCIAL_LINKS } from '../../config/site';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container site-footer-inner">
        <div className="footer-brand">
          <Logo />
          <p className="muted">Turn ordinary moments into lasting memories — snap, style and keep them, all in one place.</p>
          <ul className="footer-social" aria-label="Social media">
            {SOCIAL_LINKS.map((s) => (
              <li key={s.id}>
                <a className="icon-btn" href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}>
                  <Icon name={s.id} size={18} />
                </a>
              </li>
            ))}
          </ul>
        </div>
        <nav className="footer-col" aria-label="Footer">
          <h3>Explore</h3>
          {MARKETING_NAV.map((n) => (
            <Link key={n.label} to={n.to}>
              {n.label}
            </Link>
          ))}
        </nav>
        <nav className="footer-col" aria-label="Product">
          <h3>Create</h3>
          <Link to="/booth">Open Photobooth</Link>
          <Link to="/templates">Template Gallery</Link>
          <Link to="/signup">Create Account</Link>
          <Link to="/login">Log In</Link>
        </nav>
        <nav className="footer-col" aria-label="Legal">
          <h3>Legal</h3>
          <Link to="/terms">Terms of Use</Link>
          <Link to="/privacy">Privacy Policy</Link>
        </nav>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} PhotoBooth. Made with love.</span>
        <span className="script footer-script">smile · click · remember</span>
      </div>
    </footer>
  );
}
