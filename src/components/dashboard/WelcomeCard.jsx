import React from 'react';
import Button from '../common/Button';
import { Sparkle, DoodleHeart, HeartSwirl } from '../common/misc';
import { LogoMark } from '../common/Logo';
import TemplatePreview from '../templates/TemplatePreview';
import { getTemplate } from '../../templates/data';

export default function WelcomeCard({ recent = [] }) {
  const shots = recent.slice(0, 2);
  return (
    <section className="welcome-card" aria-labelledby="welcome-title">
      <div className="welcome-copy">
        <span className="welcome-camera" aria-hidden="true">
          <LogoMark size={46} />
        </span>
        <h2 id="welcome-title">Let’s Create Something Beautiful</h2>
        <p>
          Choose a template, take a photo, and make it yours. <span aria-hidden="true">♡</span>
        </p>
        <Button to="/booth" iconRight="arrow-right">
          Open Photobooth
        </Button>
        <HeartSwirl size={70} className="welcome-swirl" />
      </div>
      <div className="welcome-art" aria-hidden="true">
        {shots.length === 2 ? (
          shots.map((s, i) => (
            <div key={s.id} className={`welcome-polaroid p${i + 1}`}>
              <img src={s.url} alt="" />
            </div>
          ))
        ) : (
          <>
            <div className="welcome-polaroid p1">
              <TemplatePreview template={getTemplate('polaroid')} scale={0.35} alt="" />
            </div>
            <div className="welcome-polaroid p2">
              <TemplatePreview template={getTemplate('love-hearts')} scale={0.35} alt="" />
            </div>
          </>
        )}
        <DoodleHeart size={30} style={{ right: '8%', top: '6%' }} />
        <DoodleHeart size={22} style={{ left: '4%', bottom: '14%' }} />
        <Sparkle size={16} className="deco-twinkle" style={{ right: '2%', bottom: '30%' }} />
        <Sparkle size={12} className="deco-twinkle" style={{ left: '12%', top: '10%', animationDelay: '1s' }} />
      </div>
    </section>
  );
}
