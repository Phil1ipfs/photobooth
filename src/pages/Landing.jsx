import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import ghost from '../assets/halloween/ghost.webp';
import pumpkin from '../assets/halloween/pumpkin.webp';

const POPULAR_IDS = ['spooky-love', 'love-hearts', 'classic', 'vintage-film', 'trick-or-treat', 'magazine', 'pumpkin-night', 'boo-together', 'vampire-date'];

function AutumnLeaf({ className = '' }) {
  return <svg className={`autumn-leaf ${className}`} viewBox="0 0 48 56" fill="none" aria-hidden="true"><path d="m24 2 5 13 8-5-1 12 10-1-7 12 6 4-17 7-4 10-2-11L5 39l6-6L2 23l12 1-2-13 9 5Z" fill="currentColor" /><path d="m24 12 1 33M13 26l12 10 11-11M14 37l11 4 10-6" stroke="var(--bg)" strokeOpacity=".4" strokeWidth="1.2" /></svg>;
}

function Bat({ className = '' }) {
  return <svg className={`halloween-bat ${className}`} viewBox="0 0 70 36" aria-hidden="true"><path fill="currentColor" d="M35 15 31 9l-1 7C21 5 10 2 1 5c7 4 10 9 10 16 6-5 12-3 16 4 3-2 5 1 8 8 3-7 5-10 8-8 4-7 10-9 16-4 0-7 3-12 10-16-9-3-20 0-29 11l-1-7Z" /></svg>;
}

const FEATURES = [
  { icon: 'templates', title: `${TEMPLATES.length} Templates`, text: 'Classic is free. Unlock every look with Premium.' },
  { icon: 'download', title: 'Instant Download', text: 'Keep your classic photo strip for free.' },
  { icon: 'wand', title: 'Easy to Use', text: 'Simple, clean, and fun to navigate.' },
  { icon: 'share', title: 'Share the Memories', text: 'Unlock sharing and printing with Premium.' },
];

const STEPS = [
  { n: '01', icon: 'camera', title: 'Pick your vibe', text: 'Start with Classic for free, or explore cute, retro and seasonal strips with Premium.' },
  { n: '02', icon: 'wand', title: 'Strike a pose', text: 'A gentle countdown snaps your photos. Don’t love one? Retake just that slot.' },
  { n: '03', icon: 'heart', title: 'Keep the memory', text: 'Download your strip. Unlock sharing, printing and your personal gallery with Premium.' },
];

export default function Landing() {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [demo, setDemo] = useState(false);
  const carousel = useRef(null);
  const popular = POPULAR_IDS.map(getTemplate);
  const [carouselEnds, setCarouselEnds] = useState({ start: true, end: false });
  const updateCarousel = useCallback(() => {
    const row = carousel.current;
    if (row) setCarouselEnds({ start: row.scrollLeft < 2, end: row.scrollLeft + row.clientWidth >= row.scrollWidth - 2 });
  }, []);
  useEffect(() => {
    updateCarousel();
    window.addEventListener('resize', updateCarousel);
    return () => window.removeEventListener('resize', updateCarousel);
  }, [updateCarousel]);
  const scrollTemplates = (direction) => {
    const row = carousel.current;
    row?.scrollBy({ left: direction * row.clientWidth * 0.75, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };

  return (
    <div className="landing halloween-landing">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header />

      <main id="main">
        {/* ---------- Hero ---------- */}
        <section className="hero container">
          <div className="hero-copy page-enter">
            <span className="halloween-label"><Icon name="sparkle" size={14} /> A little spooky. A lot of memories.</span>
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
              <Icon name="sparkle" size={14} /> No app needed · Phone & desktop friendly
            </p>
            <p className="hero-free-note">Start with 2 free Classic strips. <Link to="/pricing">Explore Premium <span aria-hidden="true">→</span></Link></p>
          </div>

          <div className="hero-art" aria-hidden="true">
            <div className="hero-card hero-polaroid">
              <TemplatePreview template={getTemplate('spooky-love')} scale={0.4} alt="" />
            </div>
            <div className="hero-card hero-main">
              <TemplatePreview template={getTemplate('vampire-date')} scale={0.5} alt="" />
            </div>
            <div className="hero-card hero-pink">
              <TemplatePreview template={getTemplate('trick-or-treat')} scale={0.45} alt="" />
            </div>
            <span className="hero-good script">
              spooky
              <br />
              vibes
            </span>
            <DoodleHeart size={44} className="hero-doodle-1" />
            <HeartSwirl size={90} className="hero-swirl" />
            <div className="hero-pumpkin">
              <span className="hero-pumpkin-glow" />
              <img src={pumpkin} className="hero-pumpkin-image" width="640" height="533" alt="" fetchPriority="high" />
              <svg className="hero-pumpkin-shade" viewBox="0 0 640 533" fill="#4b210e">
                <path d="M263 242Q283 213 317 179Q323 174 327 184Q337 215 340 256Q307 255 266 245Z" />
                <path d="M452 269Q458 222 476 190Q480 184 484 192Q511 223 525 263Q490 263 453 272Z" />
                <path d="M369 296L396 255Q400 249 404 257L424 299Q401 305 370 299Z" />
                <path d="M244 278Q272 301 317 317L316 337Q331 343 344 341L349 329Q393 337 436 334L441 347Q456 350 466 346L469 331Q501 320 526 303Q513 349 457 387L450 371L425 372L417 390Q377 392 344 387L344 363L320 356L306 373Q267 351 244 278Z" />
              </svg>
            </div>
            <Bat className="hero-bat-one" /><Bat className="hero-bat-two" />
            <AutumnLeaf className="hero-leaf-one" /><AutumnLeaf className="hero-leaf-two" />
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
            <span className="eyebrow">Find your favorite</span>
            <h2 id="popular-title" className="section-heading">
              Popular Templates
            </h2>
            <p className="muted">From cute and minimalist to bold and vintage — find the perfect style for you.</p>
            <Button variant="outline" size="sm" iconRight="arrow-right" to="/templates">
              Browse All Templates
            </Button>
          </div>
          <div className="popular-gallery">
          <ul id="popular-templates" className="popular-row" ref={carousel} onScroll={updateCarousel} aria-label="Popular photo strip templates">
            {popular.map((t) => (
              <li key={t.id}>
                <button
                  className="popular-item"
                  onClick={() => navigate(`/booth?template=${t.id}`)}
                  aria-label={`Use the ${t.name} template`}
                >
                  <TemplatePreview template={t} scale={0.32} alt="" />
                  <span>{t.name}</span>
                  <small className={`popular-tier${t.id === 'classic' ? ' popular-tier-free' : ''}`}>{t.id === 'classic' ? 'Free' : 'Premium'}</small>
                </button>
              </li>
            ))}
          </ul>
          <div className="popular-controls">
            <span>Find a little magic in every strip</span>
            <div>
              <button type="button" className="icon-btn" aria-label="Previous templates" aria-controls="popular-templates" disabled={carouselEnds.start} onClick={() => scrollTemplates(-1)}><Icon name="arrow-left" size={18} /></button>
              <button type="button" className="icon-btn" aria-label="Next templates" aria-controls="popular-templates" disabled={carouselEnds.end} onClick={() => scrollTemplates(1)}><Icon name="arrow-right" size={18} /></button>
            </div>
          </div>
          </div>
          <DoodleHeart size={28} className="popular-heart" />
        </section>

        {/* ---------- About / How it works ---------- */}
        <section id="about" className="about container" aria-labelledby="about-title">
          <div className="about-intro">
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
          <div className="about-art" aria-hidden="true">
            <img src={ghost} width="640" height="595" alt="" loading="lazy" />
            <AutumnLeaf className="about-leaf-one" /><AutumnLeaf className="about-leaf-two" />
            <DoodleHeart size={30} className="about-heart" />
          </div>
          </div>
          <ol className="steps">
            {STEPS.map((s) => (
              <li key={s.n} className="step card">
                <span className="step-icon"><Icon name={s.icon} size={30} /></span>
                <span className="sr-only">Step {s.n}. </span>
                <h3>{s.title}</h3>
                <p className="muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- CTA ---------- */}
        <section className="cta container" aria-labelledby="cta-title">
          <div className="cta-card">
            <img src={ghost} className="cta-ghost" width="640" height="595" alt="" loading="lazy" />
            <AutumnLeaf className="cta-leaf-one" /><AutumnLeaf className="cta-leaf-two" />
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
