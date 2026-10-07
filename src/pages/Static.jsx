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
      <p>PhotoBooth is a browser-based photo booth with a free plan and an optional paid Premium plan. By using it you agree to these simple terms.</p>
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
      <h2>Premium & payments</h2>
      <p>
        Premium is a one-time purchase: each payment of ₱99 unlocks Premium features for 1 year on your account.
        It does not renew automatically and you are never charged again unless you buy more time. Payments are
        processed by PayMongo (GCash, Maya or debit/credit card).
      </p>
      <p>
        If a payment went through but Premium didn’t activate, or you were charged by mistake, contact us within 7
        days and we’ll fix it or refund you. Because Premium is unlocked immediately, other purchases are
        non-refundable once used.
      </p>
    </StaticPage>
  );
}

export function Privacy() {
  return (
    <StaticPage title="Privacy Policy" updated="October 2026">
      <p>Your memories are personal. Here’s exactly what happens to your data.</p>
      <h2>Camera</h2>
      <p>
        Your camera feed is processed entirely in your browser. Individual photos never leave your device — only the
        finished strip is uploaded, and only when you’re logged in and choose to save it to My Photos.
      </p>
      <h2>Accounts & saved strips</h2>
      <p>
        When you create an account, your name, email and profile picture are stored with our database provider,
        Supabase. Passwords are handled by Supabase Auth and are never stored in plain text. Photo strips are only
        uploaded when you choose “Save”; they are kept in private storage that only your account can access. Deleting
        your account in Settings permanently removes your account and every saved strip.
      </p>
      <p>Display preferences (theme, camera settings, favorite templates) stay in your browser on this device.</p>
      <h2>Usage analytics</h2>
      <p>
        To understand how PhotoBooth is used, we record simple events such as “page viewed”, “photo captured” or
        “strip downloaded”, together with the page path and small details like the template name. Each browser gets a
        random identifier (not linked to your name or email), and if you’re logged in the event is linked to your
        account id. We never record photo contents, passwords or payment details, and we don’t use cookies or
        third-party trackers. Analytics is off if your browser sends “Do Not Track” or “Global Privacy Control”, and
        you can switch it off any time in Settings → Preferences.
      </p>
      <h2>Payments</h2>
      <p>
        Premium payments are processed by PayMongo. Your card, GCash or Maya details go directly to PayMongo —
        PhotoBooth never sees or stores them. We keep only your plan, the payment reference, amount and the date your
        Premium ends so we know which features to unlock.
      </p>
      <h2>Your consent</h2>
      <p>
        When you create an account you agree to these Terms and this Privacy Policy, and we record that agreement (the
        policy version and the date) with your account. You can withdraw your consent at any time by deleting your
        account in Settings — this permanently removes your account details and every saved strip. If we change these
        documents in a meaningful way, we’ll ask you to agree again.
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
