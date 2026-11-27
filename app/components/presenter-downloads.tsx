import { Download, Monitor, Smartphone } from 'lucide-react';
import { presenterHome, presenterProEmail, presenterReleases, type PresenterPlatform } from '../../lib/presenter-releases';

const platforms: PresenterPlatform[] = ['windows', 'android'];

export default function PresenterDownloads({ home = presenterHome }: { home?: string }) {
  return (
    <section className="entry-downloads" id="presenter-downloads" aria-labelledby="presenter-downloads-title">
      <h2 id="presenter-downloads-title">Download Worship Presenter</h2>
      <p>Start a 15-day free trial on Windows. The Android APK is included with Ekklo. Pro.</p>
      <ul className="entry-platforms">
        {platforms.map(platform => {
          const release = presenterReleases[platform];
          const Icon = platform === 'windows' ? Monitor : Smartphone;
          const link = new URL(home);
          link.searchParams.set('download', platform);
          return (
            <li key={platform}>
              <span className="entry-platform-icon"><Icon size={23} aria-hidden="true" /></span>
              <div className="entry-platform-info">
                <h3>{release.platform}</h3>
                <p>{release.version} · {release.format} · {platform === 'windows' ? '15-day trial' : 'Pro license required'}</p>
              </div>
              <a className="entry-primary" href={link.href}>
                <Download size={16} aria-hidden="true" /> {platform === 'windows' ? 'Download for Windows' : 'Enter Pro license'}
              </a>
            </li>
          );
        })}
      </ul>
      <p><a className="entry-text-action" href={presenterProEmail}>Email to purchase Pro</a></p>
    </section>
  );
}
