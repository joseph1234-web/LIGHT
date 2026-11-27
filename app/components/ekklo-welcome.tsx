'use client';

import { CalendarDays, Image, ListVideo, Mail, Monitor, Pause, Play, Send, Smartphone } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { presenterContactEmail, presenterHome } from '../../lib/presenter-releases';
import PresenterDownloads from './presenter-downloads';
import { StagePreview, WorkspacePreview } from './welcome-previews';

const sections = [
  { id: 'features', label: 'Church tools' },
  { id: 'presenter', label: 'Worship Presenter' },
  { id: 'developer', label: 'Developer' },
];

const features = [
  { icon: CalendarDays, title: 'Plan your church posts',
    description: 'Schedule a Bible verse for each morning, an invitation for Saturday, or a one-time church event. See them together on your calendar.' },
  { icon: Image, title: 'Design with Canva',
    description: 'Prepare verse and invitation posts with your saved Canva templates. Use your church’s own artwork for countdowns and special events.' },
  { icon: Send, title: 'Publish to Facebook',
    description: 'Choose your church’s Facebook Page and turn on scheduled publishing. Ready posts go out in their posting window.' },
];

const motionKey = 'ekklo:welcome:pause-motion';

export default function EkkloWelcome({
  accountHome = presenterHome, assetBase = '/', workspaceHref, signedIn = false,
}: {
  accountHome?: string; assetBase?: string; workspaceHref?: string; signedIn?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLElement>(null);
  const [systemReduced, setSystemReduced] = useState<boolean | null>(null);
  const [paused, setPaused] = useState(false);
  const [currentSection, setCurrentSection] = useState('');
  const motion = systemReduced === false && !paused;
  const motionLabel = systemReduced ? 'Reduced motion is on' : motion ? 'Pause animations' : 'Play animations';
  const loginHref = new URL('?workspace=1', accountHome).href;
  const signupHref = new URL('?workspace=1&mode=signup', accountHome).href;

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setSystemReduced(preference.matches);
    sync();
    try { setPaused(localStorage.getItem(motionKey) === 'yes'); } catch { /* Storage is optional. */ }
    preference.addEventListener('change', sync);
    return () => preference.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const page = root.current;
    const nav = header.current;
    if (!page || !nav) return;
    const targets = sections.map(section => document.getElementById(section.id));
    let frame = 0;
    const measure = () => {
      frame = 0;
      const end = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      const progress = Math.min(1, Math.max(0, window.scrollY / end));
      nav.style.setProperty('--welcome-progress', String(progress));
      const marker = nav.getBoundingClientRect().bottom + window.innerHeight * .24;
      let section = '';
      for (const target of targets) {
        if (target && target.getBoundingClientRect().top <= marker) section = target.id;
      }
      setCurrentSection(progress >= .998 ? 'developer' : section);
    };
    function scheduleMeasure() {
      if (!frame) frame = requestAnimationFrame(measure);
    }
    // The public welcome page mounts after account configuration has loaded.
    const hashTarget = document.getElementById(window.location.hash.slice(1));
    if (hashTarget && page.contains(hashTarget)) hashTarget.scrollIntoView({ behavior: 'instant' });
    measure();
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleMeasure);
    resize?.observe(page);
    window.addEventListener('scroll', scheduleMeasure, { passive: true });
    window.addEventListener('resize', scheduleMeasure);
    const reveal = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('welcome-arrived');
          reveal?.unobserve(entry.target);
        }
      });
    }, { threshold: .1 });
    page.querySelectorAll('[data-reveal]').forEach(element => reveal?.observe(element));
    return () => {
      window.removeEventListener('scroll', scheduleMeasure);
      window.removeEventListener('resize', scheduleMeasure);
      cancelAnimationFrame(frame);
      resize?.disconnect();
      reveal?.disconnect();
    };
  }, []);

  function toggleMotion() {
    const next = !paused;
    setPaused(next);
    try {
      if (next) localStorage.setItem(motionKey, 'yes');
      else localStorage.removeItem(motionKey);
    } catch { /* The setting still applies for this visit. */ }
  }

  return (
    <div className="welcome-page" id="top" ref={root} data-motion={motion ? 'on' : 'off'}>
      <a className="welcome-skip" href="#welcome-main">Skip to content</a>
      <header className="welcome-header" ref={header}>
        <div className="welcome-container welcome-header-inner">
          <a className="welcome-brand" href="#top" aria-label="Ekklo. home">
            <img src={assetBase + 'ekklo-mark.png'} width={34} height={34} alt="" />
            <span>ekklo<span>.</span></span>
          </a>
          <nav className="welcome-nav" aria-label="Welcome page">
            {sections.map(({ id, label }) => (
              <a key={id} href={'#' + id} aria-current={currentSection === id ? 'location' : undefined}>{label}</a>
            ))}
          </nav>
          <div className="welcome-account">
            <button type="button" className="welcome-motion" disabled={systemReduced !== false}
              aria-label={motionLabel} title={motionLabel} onClick={toggleMotion}>
              {motion ? <Pause size={16} fill="currentColor" aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
              <span>{systemReduced ? 'Motion off' : motion ? 'Pause' : 'Play'}</span>
            </button>
            {signedIn ? (
              <a className="welcome-button welcome-primary" href={workspaceHref ?? loginHref}>Open workspace</a>
            ) : (
              <>
                <a className="welcome-login" href={loginHref}>Log in</a>
                <a className="welcome-button welcome-primary" href={signupHref}>Sign up</a>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="welcome-main" tabIndex={-1}>
        <section className="welcome-hero" id="church-workspace" aria-labelledby="welcome-title">
          <div className="welcome-hero-art" aria-hidden="true"><i /><i /></div>
          <div className="welcome-container welcome-hero-grid">
            <div className="welcome-intro">
              <h1 id="welcome-title">Your church’s <span>social media</span> <em>planner.</em></h1>
              <p>Prepare Bible verses, Sunday invitations, and announcements for your church’s Facebook Page. Plan the week in one place.</p>
              <div className="welcome-actions">
                <a className="welcome-button welcome-primary" href={workspaceHref ?? signupHref}>
                  {workspaceHref ? 'Open church workspace' : 'Get started'}
                </a>
                <a className="welcome-button welcome-secondary" href="#features">Explore church tools</a>
              </div>
            </div>
            <WorkspacePreview assetBase={assetBase} motion={motion} interactive={systemReduced !== null} />
          </div>
        </section>

        <section className="welcome-container welcome-features" id="features" aria-labelledby="welcome-features-title">
          <h2 className="welcome-section-title" id="welcome-features-title" data-reveal>From your calendar to your <em>church’s Page.</em></h2>
          <ul className="welcome-feature-list">
            {features.map(({ icon: Icon, title, description }) => (
              <li key={title} data-reveal>
                <span className="welcome-feature-icon"><Icon size={23} aria-hidden="true" /></span>
                <h3>{title}</h3><p>{description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="welcome-presenter" id="presenter" aria-labelledby="welcome-presenter-title">
          <div className="welcome-container">
            <div className="welcome-presenter-intro">
              <div className="welcome-presenter-copy" data-reveal>
                <h2 className="welcome-section-title" id="welcome-presenter-title">Ekklo. Worship <em>Presenter</em></h2>
                <p>Prepare the service on your Windows PC and choose what the congregation sees on screen.</p>
                <ul>
                  <li><ListVideo size={18} aria-hidden="true" /> Organize service slides and song lyrics</li>
                  <li><Monitor size={18} aria-hidden="true" /> Present Bible verses on the church screen</li>
                  <li><Smartphone size={18} aria-hidden="true" /> Follow the stage or control the PC from Android</li>
                </ul>
                <a className="welcome-download-link" href="#presenter-downloads">See Presenter downloads</a>
              </div>
              <StagePreview assetBase={assetBase} interactive={systemReduced !== null} />
            </div>
            <PresenterDownloads home={accountHome} />
          </div>
        </section>
      </main>

      <footer className="welcome-footer" id="developer">
        <div className="welcome-container welcome-footer-inner">
          <div><span>Developer</span><h2>Joseph F. Fajilagutan</h2></div>
          <a href={`mailto:${presenterContactEmail}`}><Mail size={18} aria-hidden="true" />{presenterContactEmail}</a>
        </div>
      </footer>
    </div>
  );
}
