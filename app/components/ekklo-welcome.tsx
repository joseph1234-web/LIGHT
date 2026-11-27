import { BookOpen, CalendarDays, Church, Image, Link2, ListVideo, Mail, Monitor, Send, Smartphone } from 'lucide-react';
import { presenterContactEmail, presenterHome } from '../../lib/presenter-releases';
import PresenterDownloads from './presenter-downloads';

const features = [
  {
    icon: CalendarDays,
    title: 'Plan your church posts',
    description: 'Manage recurring posts and one-time events in the same calendar. See what’s scheduled and which posts still need artwork.',
  },
  {
    icon: Image,
    title: 'Create artwork with Canva',
    description: 'Use saved Canva templates for verses and invitations, and upload your own artwork for countdowns and events.',
  },
  {
    icon: Send,
    title: 'Publish to your Facebook Page',
    description: 'Connect your church’s Facebook Page and enable automatic publishing for the posts you’ve scheduled.',
  },
];

const examplePosts = [
  { icon: BookOpen, title: 'Morning Bible verse', time: 'Monday · 7:00 AM', status: 'Scheduled' },
  { icon: Church, title: 'Sunday service invitation', time: 'Saturday · 9:00 AM', status: 'Ready' },
  { icon: Image, title: 'Church anniversary countdown', time: 'Next week', status: 'Draft' },
];

function WorkspacePreview() {
  return (
    <figure className="welcome-preview">
      <figcaption className="welcome-preview-bar">
        <span><CalendarDays size={17} aria-hidden="true" /> Church planner</span>
        <small>Workspace preview</small>
      </figcaption>
      <div className="welcome-preview-body">
        <div className="welcome-preview-sidebar" aria-hidden="true">
          <span><CalendarDays size={16} /> Calendar</span>
          <span><Church size={16} /> Church posts</span>
          <span><Image size={16} /> Templates</span>
          <span><Link2 size={16} /> Connections</span>
        </div>
        <div className="welcome-preview-agenda">
          <h2>Upcoming posts</h2>
          <ul>
            {examplePosts.map(({ icon: Icon, title, time, status }) => (
              <li key={title}>
                <span className="welcome-preview-icon"><Icon size={18} aria-hidden="true" /></span>
                <div><strong>{title}</strong><small>{time}</small></div>
                <span className="welcome-preview-state" data-status={status}>{status}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="welcome-preview-verse">
          <span>Morning encouragement</span>
          <p>The Lord is my shepherd.</p>
          <small>Psalm 23:1</small>
        </div>
      </div>
    </figure>
  );
}

export default function EkkloWelcome({
  accountHome = presenterHome,
  assetBase = '/',
  workspaceHref,
  signedIn = false,
}: {
  accountHome?: string;
  assetBase?: string;
  workspaceHref?: string;
  signedIn?: boolean;
}) {
  const loginHref = new URL('?workspace=1', accountHome).href;
  const signupHref = new URL('?workspace=1&mode=signup', accountHome).href;

  return (
    <div className="welcome-page" id="top">
      <a className="welcome-skip" href="#welcome-main">Skip to content</a>
      <header className="welcome-header">
        <div className="welcome-container welcome-header-inner">
          <a className="welcome-brand" href="#top" aria-label="Ekklo. home">
            <img src={assetBase + 'ekklo-mark.png'} width={32} height={32} alt="" />
            <span>ekklo<span>.</span></span>
          </a>
          <nav className="welcome-nav" aria-label="Welcome page">
            <a href="#features">Church tools</a>
            <a href="#presenter">Worship Presenter</a>
            <a href="#developer">Developer</a>
          </nav>
          <div className="welcome-account">
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
          <div className="welcome-container">
            <div className="welcome-intro">
              <h1 id="welcome-title">Your church’s <span>social media planner.</span></h1>
              <p>Prepare and schedule Bible verse posts, Sunday invitations, and church announcements for your Facebook Page.</p>
              <div className="welcome-hero-actions">
                <a className="welcome-button welcome-primary" href={workspaceHref ?? signupHref}>
                  {workspaceHref ? 'Open church workspace' : 'Get started'}
                </a>
                <a className="welcome-button welcome-secondary" href="#features">Explore church tools</a>
              </div>
            </div>
            <WorkspacePreview />
          </div>
        </section>

        <section className="welcome-container welcome-section" id="features" aria-labelledby="welcome-features-title">
          <h2 className="welcome-features-title" id="welcome-features-title">From your calendar to your church’s Page</h2>
          <ul className="welcome-feature-grid">
            {features.map(({ icon: Icon, title, description }) => (
              <li key={title}>
                <span className="welcome-feature-icon"><Icon size={22} aria-hidden="true" /></span>
                <h3>{title}</h3>
                <p>{description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="welcome-container welcome-section welcome-presenter" id="presenter" aria-labelledby="welcome-presenter-title">
          <div className="welcome-presenter-intro">
            <div className="welcome-presenter-copy">
              <h2 id="welcome-presenter-title">Ekklo. Worship Presenter</h2>
              <p>Manage the service order and what the congregation sees from one Windows workspace.</p>
              <ul>
                <li><ListVideo size={18} aria-hidden="true" /> Organize service slides and song lyrics</li>
                <li><Monitor size={18} aria-hidden="true" /> Present Bible verses on the church screen</li>
                <li><Smartphone size={18} aria-hidden="true" /> Follow the stage or control the PC from Android</li>
              </ul>
            </div>
            <figure className="welcome-stage-preview">
              <figcaption><Monitor size={17} aria-hidden="true" /> Stage view preview</figcaption>
              <div className="welcome-stage-screen">
                <p>Be still, and know<br />that I am God.</p>
                <small>Psalm 46:10</small>
              </div>
            </figure>
          </div>
          <PresenterDownloads home={accountHome} />
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
