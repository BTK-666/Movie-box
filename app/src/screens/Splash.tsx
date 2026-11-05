import React from 'react';
import { IconLogo } from '../components/Icons';

export default function Splash() {
  return (
    <div className="splash">
      <span className="splash-ad">Ad · 3s</span>
      <div className="splash-logo">
        <IconLogo size={72} />
      </div>
      <div className="splash-name">
        Movie<span className="grad-text">Box</span>+
      </div>
      <div className="splash-tag">Stream · Download · Discover</div>
      <div className="splash-loader" />
    </div>
  );
}
