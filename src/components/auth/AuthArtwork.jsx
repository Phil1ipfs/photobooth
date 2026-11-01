import React from 'react';
import { DoodleHeart, Sparkle } from '../common/misc';
import ghost from '../../assets/auth-halloween/witch-ghost.webp';
import pumpkin from '../../assets/auth-halloween/smiling-pumpkin.webp';
import lantern from '../../assets/auth-halloween/heart-lantern.webp';
import foliage from '../../assets/auth-halloween/foliage-border.webp';
import cobweb from '../../assets/auth-halloween/cobweb.svg';
import redLeaf from '../../assets/auth-halloween/maple-leaf-red.svg';
import orangeLeaf from '../../assets/auth-halloween/maple-leaf-orange.svg';

export function AuthTopDecor() {
  return (
    <div className="auth-top-decor" aria-hidden="true">
      <img className="auth-cobweb" src={cobweb} alt="" />
      <Sparkle size={16} className="auth-star-one" />
      <Sparkle size={25} className="auth-star-two" />
      <Sparkle size={17} className="auth-star-three" />
      <DoodleHeart size={18} className="auth-top-heart-one" filled />
      <DoodleHeart size={20} className="auth-top-heart-two" filled />
      <img className="auth-top-leaf-one" src={redLeaf} alt="" />
      <img className="auth-top-leaf-two" src={orangeLeaf} alt="" />
    </div>
  );
}

export function AuthGarden() {
  return (
    <div className="auth-garden" aria-hidden="true">
      <img className="auth-garden-foliage" src={foliage} width="1200" height="400" alt="" draggable="false" />
      <img className="auth-garden-pumpkin" src={pumpkin} width="400" height="400" alt="" draggable="false" />
      <img className="auth-garden-lantern" src={lantern} width="260" height="284" alt="" draggable="false" />
      <img className="auth-garden-ghost" src={ghost} width="480" height="439" alt="" draggable="false" />
      <DoodleHeart size={20} className="auth-garden-heart-one" filled />
      <DoodleHeart size={16} className="auth-garden-heart-two" filled />
      <Sparkle size={14} className="auth-garden-star" />
      <img className="auth-garden-leaf-one" src={redLeaf} alt="" />
      <img className="auth-garden-leaf-two" src={orangeLeaf} alt="" />
    </div>
  );
}
