import React from 'react';
import { DoodleHeart, Sparkle } from '../common/misc';
import pumpkin from '../../assets/halloween/pumpkin.webp';

function Ghost({ className }) {
  return (
    <svg className={`welcome-ghost ${className}`} viewBox="0 0 100 112" fill="none">
      <path d="M18 56V38C18 17 31 6 50 6s32 12 32 32v18l13 17c4 6-2 12-8 8l-8-6 5 25c1 6-6 9-10 4l-9-10-9 13c-3 5-8 5-11 0L34 94l-9 10c-4 5-11 2-10-4l5-25-8 6c-6 4-12-2-8-8Z" fill="currentColor" />
      <ellipse cx="39" cy="40" rx="5" ry="9" transform="rotate(-12 39 40)" fill="#29101e" />
      <ellipse cx="62" cy="39" rx="5" ry="9" transform="rotate(12 62 39)" fill="#29101e" />
      <ellipse cx="51" cy="61" rx="5" ry="7" fill="#29101e" />
    </svg>
  );
}

function Bat({ className }) {
  return (
    <svg className={`welcome-bat ${className}`} viewBox="0 0 70 36">
      <path fill="currentColor" d="M35 15 31 9l-1 7C21 5 10 2 1 5c7 4 10 9 10 16 6-5 12-3 16 4 3-2 5 1 8 8 3-7 5-10 8-8 4-7 10-9 16-4 0-7 3-12 10-16-9-3-20 0-29 11l-1-7Z" />
    </svg>
  );
}

/** Decorative layers around the dashboard's existing saved strips/previews. */
export default function WelcomeDecor() {
  return (
    <>
      <div className="welcome-haunting" aria-hidden="true">
        <Ghost className="welcome-ghost-one" />
        <Ghost className="welcome-ghost-two" />
        <Bat className="welcome-bat-one" />
        <Bat className="welcome-bat-two" />
        <Bat className="welcome-bat-three" />
        <DoodleHeart size={25} className="welcome-heart-one" />
        <Sparkle size={17} className="welcome-star-one deco-twinkle" />
        <Sparkle size={11} className="welcome-star-two deco-twinkle" />
        <Sparkle size={21} className="welcome-star-three deco-twinkle" />
      </div>
      <div className="welcome-autumn" aria-hidden="true">
        <span className="welcome-embers" />
        <img src={pumpkin} className="welcome-pumpkin welcome-pumpkin-small" width="640" height="533" alt="" draggable="false" />
        <img src={pumpkin} className="welcome-pumpkin welcome-pumpkin-large" width="640" height="533" alt="" draggable="false" />
        <Sparkle size={12} className="welcome-ember-one deco-twinkle" />
        <Sparkle size={9} className="welcome-ember-two deco-twinkle" />
      </div>
    </>
  );
}
