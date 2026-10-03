import React, { useEffect, useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Icon from '../common/Icon';
import TemplatePreview from '../templates/TemplatePreview';
import { TEMPLATES, getTemplate } from '../../templates/data';

const STEPS = [
  { icon: 'templates', title: 'Choose a template', text: `Pick from ${TEMPLATES.length} aesthetic strips — cute, retro, minimal and more.` },
  { icon: 'camera', title: 'Strike a pose', text: 'A friendly countdown snaps four photos in a row. Retake any slot.' },
  { icon: 'download', title: 'Download & share', text: 'Your strip renders instantly in high quality — download, print or share.' },
];

const DEMO_TEMPLATES = ['pink-pop', 'love-hearts', 'retro-70s'];

/** Short animated walkthrough of how the photobooth works. */
export default function DemoModal({ open, onClose }) {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep(0);
      return undefined;
    }
    if (paused) return undefined;
    const t = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 3200);
    return () => clearInterval(t);
  }, [open, paused]);

  return (
    <Modal open={open} onClose={onClose} title="How PhotoBooth works" width={640}>
      <div className="demo" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        <div className="demo-stage" aria-live="polite">
          {step === 0 && (
            <div className="demo-templates" key="s0">
              {DEMO_TEMPLATES.map((id, i) => (
                <div key={id} className={`demo-tpl${i === 1 ? ' active' : ''}`}>
                  <TemplatePreview template={getTemplate(id)} scale={0.3} alt="" />
                </div>
              ))}
            </div>
          )}
          {step === 1 && (
            <div className="demo-camera" key="s1">
              <span className="demo-count">3</span>
              <span className="live-badge">
                <i aria-hidden="true" />
                LIVE
              </span>
            </div>
          )}
          {step === 2 && (
            <div className="demo-final" key="s2">
              <TemplatePreview template={getTemplate('love-hearts')} scale={0.35} alt="" />
              <span className="demo-check">
                <Icon name="check" size={20} strokeWidth={3} />
              </span>
            </div>
          )}
        </div>
        <ol className="demo-steps">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <button className="demo-step" aria-current={i === step ? 'step' : undefined} onClick={() => setStep(i)}>
                <span className="demo-step-icon">
                  <Icon name={s.icon} size={18} />
                </span>
                <span>
                  <strong>
                    {i + 1}. {s.title}
                  </strong>
                  <small>{s.text}</small>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="modal-actions">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
        <Button to="/booth" iconRight="arrow-right">
          Try it now
        </Button>
      </div>
    </Modal>
  );
}
