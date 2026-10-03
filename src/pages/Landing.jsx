import React, { useState } from 'react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Button from '../components/common/Button';
import Icon from '../components/common/Icon';
import { Sparkle, DoodleHeart, HeartSwirl } from '../components/common/misc';
import TemplatePreview from '../components/templates/TemplatePreview';
import DemoModal from '../components/landing/DemoModal';
import { Link, useRouter } from '../lib/router';
import { useAuth } from '../context/AuthContext';
import { TEMPLATES, getTemplate } from '../templates/data';

const FEATURES = [
  { icon: 'templates', title: `${TEMPLATES.length}+ Templates`, text: 'Choose from a variety of cute and trendy layouts.' },
  { icon: 'download', title: 'Instant Download', text: 'Save your photos in high quality.' },
  { icon: 'wand', title: 'Easy to Use', text: 'Simple, clean, and fun to navigate.' },
  { icon: 'share', title: 'Share the Memories', text: 'Print, post, or keep them for yourself.' },
];

const STEPS = [
  { n: '01', title: 'Pick your vibe', text: 'Browse cute, retro, minimal and seasonal strips, then choose your favorite.' },
  { n: '02', title: 'Strike a pose', text: 'A gentle countdown snaps four photos. Don’t love one? Retake just that slot.' },
  { n: '03', title: 'Keep the memory', text: 'Download, print or share your strip — or save it to your personal gallery.' },
];

export default function Landing() {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [demo, setDemo] = useState(false);
  const popular = TEMPLATES.filter((t) => t.popular);

  return (
    <div className="landing">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header />

      <main id="main">
        {/* ---------- Hero ---------- */}
        <section className="hero container">
          <div className="hero-copy page-enter">
            <Sparkle size={16} className="deco-twinkle" style={{ left: '62%', top: -6 }} />
            <Sparkle size={10} className="deco-twinkle" style={{ left: '70%', top: 26, animationDelay: '.8s' }} />
            <h1 className="hero-title">
              Capture
              <br />
              Your Best
              <span className="hero-script script">
                Moments
                <DoodleHeart size={44} className="hero-script-heart" />
              </span>
            </h1>
            <p className="hero-text">
              Turn your ordinary moments into lasting memories with our online photobooth. Snap, edit, and keep your
              favorite memories — all in one place.
            </p>
            <div className="hero-ctas">
              <Button size="lg" iconRight="arrow-right" to={user ? '/booth' : '/signup'}>
                Get Started
              </Button>
              <Button size="lg" variant="outline" icon="play" onClick={() => setDemo(true)}>
                Watch Demo
              </Button>
            </div>
            <p className="hero-note">
              <Icon name="sparkle" size={14} /> No download needed · Works on phone & desktop ·{' '}
              <Link to="/booth">Try it without an account</Link>
            </p>
          </div>

          <div className="hero-art" aria-hidden="true">
            <div className="hero-card hero-polaroid">
              <TemplatePreview template={getTemplate('polaroid')} scale={0.4} alt="" />
            </div>
            <div className="hero-card hero-main">
              <TemplatePreview template={getTemplate('love-hearts')} scale={0.5} alt="" />
            </div>
            <div className="hero-card hero-pink">
              <TemplatePreview template={getTemplate('pink-pop')} scale={0.45} alt="" />
            </div>
            <span className="hero-good script">
              good
              <br />
              vibes
            </span>
            <DoodleHeart size={44} className="hero-doodle-1" />
            <HeartSwirl size={90} className="hero-swirl" />
            <Sparkle size={18} className="deco-twinkle" style={{ right: '6%', top: '14%' }} />
            <Sparkle size={12} className="deco-twinkle" style={{ right: '2%', top: '52%', animationDelay: '1.4s' }} />
            <Sparkle size={14} className="deco-twinkle" style={{ left: '30%', bottom: '2%', animationDelay: '.6s' }} />
          </div>
        </section>

        {/* ---------- Features ---------- */}
        <section id="features" className="features" aria-label="Features">
          <div className="container features-inner">
            {FEATURES.map((f) => (
              <div key={f.title} className="feature">
                <span className="feature-icon">
                  <Icon name={f.icon} size={22} />
                </span>
                <div>
                  <h2 className="feature-title">{f.title}</h2>
                  <p className="feature-text">{f.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- Popular templates ---------- */}
        <section id="templates" className="popular container" aria-labelledby="popular-title">
          <div className="popular-copy">
            <h2 id="popular-title" className="section-heading">
              Popular Templates
            </h2>
            <p className="muted">From cute and minimalist to bold and vintage — find the perfect style for you.</p>
            <Button variant="outline" size="sm" iconRight="arrow-right" to="/templates">
              Browse All Templates
            </Button>
          </div>
          <ul className="popular-row">
            {popular.map((t) => (
              <li key={t.id}>
                <button
                  className="popular-item"
                  onClick={() => navigate(`/booth?template=${t.id}`)}
                  aria-label={`Use the ${t.name} template`}
                >
                  <TemplatePreview template={t} scale={0.32} alt="" />
                  <span>{t.name}</span>
                </button>
              </li>
            ))}
          </ul>
          <DoodleHeart size={28} className="popular-heart" />
        </section>

        {/* ---------- About / How it works ---------- */}
        <section id="about" className="about container" aria-labelledby="about-title">
          <div className="about-head">
            <span className="eyebrow">About PhotoBooth</span>
            <h2 id="about-title" className="section-heading">
              A little booth for <span className="script accent">big</span> memories
            </h2>
            <p className="muted">
              PhotoBooth brings the charm of a classic photo strip to your browser. Your camera stays on your device —
              photos are only saved when you choose to.
            </p>
          </div>
          <ol className="steps">
            {STEPS.map((s) => (
              <li key={s.n} className="step card">
                <span className="step-n">{s.n}</span>
                <h3>{s.title}</h3>
                <p className="muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- CTA ---------- */}
        <section className="cta container" aria-labelledby="cta-title">
          <div className="cta-card">
            <Sparkle size={20} className="deco-twinkle" style={{ left: '8%', top: '22%' }} />
            <Sparkle size={12} className="deco-twinkle" style={{ right: '12%', bottom: '24%', animationDelay: '1s' }} />
            <DoodleHeart size={54} className="cta-heart" />
            <span className="script cta-script">smile · click · remember</span>
            <h2 id="cta-title">Ready to make a memory?</h2>
            <p>Grab your favorite people, pick a template and start snapping.</p>
            <Button size="lg" iconRight="arrow-right" to="/booth" className="cta-btn">
              Create Your Photo Strip
            </Button>
          </div>
        </section>
      </main>

      <Footer />
      <DemoModal open={demo} onClose={() => setDemo(false)} />
    </div>
  );
}
