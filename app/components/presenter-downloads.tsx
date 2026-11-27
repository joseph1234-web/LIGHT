import { Download, Monitor, Smartphone } from 'lucide-react';
import { presenterHome, presenterReleases, type PresenterPlatform } from '../../lib/presenter-releases';

const platforms: PresenterPlatform[] = ['windows', 'android'];

export default function PresenterDownloads({ home = presenterHome }: { home?: string }) {
  return (
    <section className="entry-downloads" id="presenter-downloads" aria-labelledby="presenter-downloads-title">
      <h2 id="presenter-downloads-title">Download Worship Presenter</h2>
      <p>Sign in to your Ekklo account to download the app for your device.</p>
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
                <p>{release.version} · {release.format} · {Math.round(release.bytes / 1_000_000)} MB</p>
              </div>
              <a className="entry-primary" href={link.href}>
                <Download size={16} aria-hidden="true" /> Download for {release.platform}
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
