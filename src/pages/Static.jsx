import React from 'react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Button from '../components/common/Button';
import { DoodleHeart } from '../components/common/misc';

function StaticPage({ title, updated, children }) {
  return (
    <div className="landing">
      <Header />
      <main id="main" className="container legal page-enter">
        <h1>{title}</h1>
        {updated && <p className="muted">Last updated {updated}</p>}
        <div className="legal-body">{children}</div>
      </main>
      <Footer />
    </div>
  );
}

export function Terms() {
  return (
    <StaticPage title="Terms of Use" updated="October 2026">
      <p>PhotoBooth is a free, browser-based photo booth. By using it you agree to these simple terms.</p>
      <h2>Your photos</h2>
      <p>
        You own every photo you take. Please only photograph people who are happy to be photographed, and don’t use
        PhotoBooth to create content that is illegal, harassing or that infringes someone else’s rights.
      </p>
      <h2>The service</h2>
      <p>
        PhotoBooth is provided “as is”. We do our best to keep it working smoothly but can’t guarantee it will always be
        available or error-free. Download any strip you want to keep long-term.
      </p>
      <h2>Templates</h2>
      <p>Template designs are provided for personal use on strips you create with PhotoBooth.</p>
    </StaticPage>
  );
}

export function Privacy() {
  return (
    <StaticPage title="Privacy Policy" updated="October 2026">
      <p>Your memories are personal. Here’s exactly what happens to your data.</p>
      <h2>Camera</h2>
      <p>
        Your camera feed is processed entirely in your browser. Photos are never uploaded to a server — they exist only
        on your device until you download, share or save them.
      </p>
      <h2>Accounts & saved strips</h2>
      <p>
        Accounts, preferences and saved strips are stored in your browser’s local storage on this device. Passwords are
        salted and hashed; they are never stored in plain text. Clearing your browser data, or deleting your account in
        Settings, removes them.
      </p>
      <h2>Fonts</h2>
      <p>Typefaces are loaded from Google Fonts, which may receive your IP address as part of the request.</p>
    </StaticPage>
  );
}

export function NotFound() {
  return (
    <StaticPage title="Page not found">
      <div className="notfound">
        <DoodleHeart size={64} />
        <p className="muted">This page wandered off. Let’s get you back to making memories.</p>
        <div className="hero-ctas">
          <Button to="/" variant="outline">
            Go home
          </Button>
          <Button to="/booth" iconRight="arrow-right">
            Open Photobooth
          </Button>
        </div>
      </div>
    </StaticPage>
  );
}
