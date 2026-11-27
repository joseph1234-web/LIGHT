'use client';

import { Pause, Play } from 'lucide-react';
import { useState, type ReactNode } from 'react';

export default function EntryFrame({ children, assetBase = '/' }: { children: ReactNode; assetBase?: string }) {
  const [motionPaused, setMotionPaused] = useState(false);

  return (
    <main className="ekklo-entry">
      <div className="entry-frame">
        <section className="entry-hero" aria-label="ekklo. church publishing" data-motion={motionPaused ? 'paused' : 'playing'}>
          <div className="entry-scene" aria-hidden="true">
            <img className="entry-field" src={assetBase + 'entry-art/ekklo-glass-field.webp'} alt="" width={900} height={980} />
            <div className="entry-light" />
            <img className="entry-mark" src={assetBase + 'entry-art/ekklo-glass-mark.webp'} alt="" width={780} height={710} fetchPriority="high" />
          </div>
          <div className="entry-hero-top">
            <div className="entry-brand">
              <img src={assetBase + 'ekklo-mark.png'} width={30} height={30} alt="" />
              <span>ekklo<span className="entry-brand-dot">.</span></span>
            </div>
            <button
              className="entry-motion"
              type="button"
              aria-label={motionPaused ? 'Play animation' : 'Pause animation'}
              title={motionPaused ? 'Play animation' : 'Pause animation'}
              onClick={() => setMotionPaused(paused => !paused)}
            >
              {motionPaused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
            </button>
          </div>
          <div className="entry-message">
            <p className="entry-tagline">One Church.<br />Every Platform.</p>
            <p className="entry-content-copy">Bible verses, Sunday invitations, and church events.</p>
          </div>
        </section>
        <section className="entry-panel" aria-labelledby="entry-title">
          <div className="entry-panel-inner">{children}</div>
        </section>
      </div>
    </main>
  );
}
