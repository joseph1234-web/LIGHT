'use client';

import { BookOpen, CalendarDays, Church, Monitor, UsersRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const examplePosts = [
  { id: 'verse', icon: BookOpen, day: 'Mon', time: '7:00 AM', title: 'Morning Bible verse', status: 'Scheduled',
    label: 'Morning encouragement', headline: 'The Lord is my shepherd.', footer: 'Psalm 23:1' },
  { id: 'invitation', icon: Church, day: 'Sat', time: '9:00 AM', title: 'Sunday invitation', status: 'Ready',
    label: 'Sunday service', headline: 'Come worship with us.', footer: 'Sunday at 10:00 AM' },
  { id: 'lunch', icon: UsersRound, day: 'Sun', time: '8:00 AM', title: 'Fellowship lunch', status: 'Draft',
    label: 'Around the table', headline: 'There’s a seat for you.', footer: 'Fellowship lunch after the service' },
];

export function WorkspacePreview({ assetBase, motion, interactive }: { assetBase: string; motion: boolean; interactive: boolean }) {
  const preview = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [manual, setManual] = useState(false);
  const [hovered, setHovered] = useState(false);
  const post = examplePosts[active];

  useEffect(() => {
    if (motion && !preview.current?.contains(document.activeElement)) setManual(false);
  }, [motion]);

  useEffect(() => {
    const element = preview.current;
    if (!element || !motion || manual || hovered) return;
    let timer: number | undefined;
    let inView = !('IntersectionObserver' in window);
    function syncTimer() {
      window.clearInterval(timer);
      if (inView && !document.hidden) {
        timer = window.setInterval(() => setActive(index => (index + 1) % examplePosts.length), 7200);
      }
    }
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting && entry.intersectionRatio >= .25;
      syncTimer();
    }, { threshold: [0, .25] });
    observer?.observe(element);
    document.addEventListener('visibilitychange', syncTimer);
    syncTimer();
    return () => {
      observer?.disconnect();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', syncTimer);
    };
  }, [motion, manual, hovered]);

  return (
    <figure className="welcome-preview" ref={preview}
      onFocusCapture={() => setManual(true)}
      onPointerEnter={event => { if (event.pointerType === 'mouse') setHovered(true); }}
      onPointerLeave={() => setHovered(false)}>
      <figcaption className="welcome-preview-bar">
        <span><CalendarDays size={19} aria-hidden="true" /> Church planner</span>
        <small>Sample week</small>
      </figcaption>
      <div className="welcome-planner-body">
        <div className="welcome-post-art" id="welcome-post-sample" data-art={post.id}
          aria-live={manual ? 'polite' : 'off'} aria-atomic="true">
          <img className="welcome-post-photo" src={assetBase + 'welcome-art/first-light.webp'} width={1120} height={747} alt="" fetchPriority="high" />
          <i className="welcome-post-shape" aria-hidden="true" />
          <div className="welcome-post-type" key={post.id}>
            <span>{post.label}</span><p>{post.headline}</p><small>{post.footer}</small>
          </div>
        </div>
        <div className="welcome-agenda-title"><h2>Upcoming posts</h2><small>Select to preview</small></div>
        <div className="welcome-agenda" role="group" aria-label="Sample church posts">
          {examplePosts.map(({ id, icon: Icon, day, time, title, status }, index) => (
            <button type="button" key={id} disabled={!interactive} aria-pressed={active === index} aria-controls="welcome-post-sample"
              onClick={() => { setManual(true); setActive(index); }}>
              <span className="welcome-agenda-icon"><Icon size={17} aria-hidden="true" /></span>
              <span className="welcome-agenda-post"><strong>{title}</strong><small>{day} · {time}</small></span>
              <span className="welcome-post-status" data-status={status}>{status}</span>
            </button>
          ))}
        </div>
      </div>
    </figure>
  );
}

const slides = [
  { style: 'scripture', type: 'Scripture', title: 'Be still, and know that I am God.', detail: 'Psalm 46:10' },
  { style: 'welcome', type: 'Welcome', title: 'Welcome to worship.', detail: 'Sunday gathering' },
  { style: 'closing', type: 'Closing', title: 'Go in peace.', detail: 'Closing blessing' },
];

export function StagePreview({ assetBase, interactive }: { assetBase: string; interactive: boolean }) {
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  function move(direction: number) {
    setIndex(current => (current + direction + slides.length) % slides.length);
  }
  return (
    <figure className="welcome-stage">
      <figcaption><Monitor size={17} aria-hidden="true" /> Stage view preview</figcaption>
      <div className="welcome-stage-screen" data-slide={slide.style} id="welcome-stage-sample" aria-live="polite" aria-atomic="true">
        <img src={assetBase + 'welcome-art/first-light.webp'} width={1120} height={747} loading="lazy" alt="" />
        <div key={slide.style}><p>{slide.title}</p><small>{slide.detail}</small></div>
      </div>
      <div className="welcome-stage-controls" role="group" aria-label="Sample slide controls">
        <span>{index + 1} / {slides.length} <b>·</b> {slide.type}</span>
        <button type="button" disabled={!interactive} aria-controls="welcome-stage-sample" aria-label="Previous sample slide" onClick={() => move(-1)}>Previous</button>
        <button type="button" disabled={!interactive} aria-controls="welcome-stage-sample" aria-label="Next sample slide" onClick={() => move(1)}>Next</button>
      </div>
    </figure>
  );
}
