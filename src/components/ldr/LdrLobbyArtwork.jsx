import React from 'react';
import forestDesktop from '../../assets/ldr-halloween/forest-desktop.webp';
import forestMobile from '../../assets/ldr-halloween/forest-mobile.webp';
import pumpkins from '../../assets/ldr-halloween/pumpkins-candles.webp';
import pumpkinsMobile from '../../assets/ldr-halloween/pumpkins-candles-mobile.webp';
import fence from '../../assets/ldr-halloween/fence-lantern.webp';
import fenceMobile from '../../assets/ldr-halloween/fence-lantern-mobile.webp';
import branch from '../../assets/ldr-halloween/maple-branch.webp';
import branchMobile from '../../assets/ldr-halloween/maple-branch-mobile.webp';
import moon from '../../assets/ldr-halloween/rose-moon.webp';
import moonMobile from '../../assets/ldr-halloween/rose-moon-mobile.webp';
import leaf from '../../assets/ldr-halloween/crimson-maple-leaf.webp';
import bat from '../../assets/ldr-halloween/bat.svg';
import heart from '../../assets/ldr-halloween/floating-heart.svg';
import ember from '../../assets/ldr-halloween/ember.svg';

function Layer({ desktop, mobile, className, width, height, priority, media = '(max-width: 700px)' }) {
  return (
    <picture className={`ldr-scene-layer ${className}`}>
      <source media={media} srcSet={mobile} />
      <img src={desktop} width={width} height={height} alt="" draggable="false" decoding="async" fetchPriority={priority ? 'high' : undefined} />
    </picture>
  );
}

/** Scene is purely decorative. All room controls sit above it in the lobby. */
export default function LdrLobbyArtwork() {
  return (
    <div className="ldr-scene-art" aria-hidden="true">
      <Layer className="ldr-scene-forest" desktop={forestDesktop} mobile={forestMobile} width="1672" height="941" priority media="(max-width: 700px), (max-aspect-ratio: 1/1)" />
      <div className="ldr-scene-shade" />
      <Layer className="ldr-scene-moon" desktop={moon} mobile={moonMobile} width="640" height="427" />
      <Layer className="ldr-scene-branch" desktop={branch} mobile={branchMobile} width="1200" height="800" />
      <Layer className="ldr-scene-pumpkins" desktop={pumpkins} mobile={pumpkinsMobile} width="1100" height="733" />
      <Layer className="ldr-scene-fence" desktop={fence} mobile={fenceMobile} width="900" height="1125" />
      <img className="ldr-scene-bat ldr-scene-bat-one" src={bat} alt="" />
      <img className="ldr-scene-bat ldr-scene-bat-two" src={bat} alt="" />
      <img className="ldr-scene-bat ldr-scene-bat-three" src={bat} alt="" />
      <img className="ldr-scene-leaf ldr-scene-leaf-one" src={leaf} alt="" />
      <img className="ldr-scene-leaf ldr-scene-leaf-two" src={leaf} alt="" />
      {[1, 2, 3, 4].map((i) => <img key={i} className={`ldr-scene-heart ldr-scene-heart-${i}`} src={heart} alt="" />)}
      {[1, 2, 3, 4, 5, 6].map((i) => <img key={i} className={`ldr-scene-ember ldr-scene-ember-${i}`} src={ember} alt="" />)}
    </div>
  );
}
