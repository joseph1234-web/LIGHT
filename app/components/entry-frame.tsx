'use client';

import { Pause, Play } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import PresenterDownloads from './presenter-downloads';

export default function EntryFrame({ children, assetBase = '/', welcome = false, presenterHome }: {
  children: ReactNode;
  assetBase?: string;
  welcome?: boolean;
  presenterHome?: string;
}) {
  const [motionPaused, setMotionPaused] = useState(false);

  return (
    <main className={welcome ? 'ekklo-entry entry-welcome' : 'ekklo-entry'}>
      <div className="entry-frame">
        <section className="entry-hero" aria-label={welcome ? 'Ekklo. Worship Presenter' : 'Ekklo.'} data-motion={motionPaused ? 'paused' : 'playing'}>
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
            {welcome ? (
              <>
                <h1 className="entry-tagline">Ekklo. Worship Presenter</h1>
                <p className="entry-content-copy">Present song lyrics, Bible verses, and slides during your church service.</p>
                <nav className="entry-hero-links" aria-label="Welcome">
                  <a href="#presenter-downloads">Get Worship Presenter</a>
                  <a href="#church-workspace">Church workspace</a>
                </nav>
              </>
            ) : (
              <>
                <p className="entry-tagline">One Church.<br />Every Platform.</p>
                <p className="entry-content-copy">Bible verses, Sunday invitations, and church events.</p>
              </>
            )}
          </div>
        </section>
        {welcome && <PresenterDownloads home={presenterHome} />}
        <section className="entry-panel" id={welcome ? 'church-workspace' : undefined} aria-labelledby={welcome ? 'workspace-title' : 'entry-title'}>
          <div className="entry-panel-inner">{children}</div>
        </section>
        {welcome && (
          <footer className="entry-developer">
            <div><span>Developer</span><strong>Joseph F. Fajilagutan</strong></div>
            <a href="mailto:gmail.sepher1800@gmail.com">gmail.sepher1800@gmail.com</a>
          </footer>
        )}
      </div>
    </main>
  );
}
