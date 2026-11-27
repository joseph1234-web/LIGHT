import { presenterReleases, type PresenterPlatform } from '../lib/presenter-releases';
import type { StandaloneConfig } from '../lib/public-paths';

const bucket = 'ekklo-presenter-downloads';
const partBytes = 40 * 1024 * 1024;

export async function fetchPresenterInstaller(
  config: StandaloneConfig,
  platform: PresenterPlatform,
  accessToken: string,
  onProgress: (percent: number) => void,
  signal: AbortSignal,
): Promise<Blob> {
  if (!accessToken) throw new Error('Sign in to Ekklo to download the app.');

  const release = presenterReleases[platform];
  const parts: Blob[] = [];
  let received = 0;
  for (let part = 0; received < release.bytes; part += 1) {
    const name = release.fileName + '.part-' + String(part).padStart(2, '0') + '.bin';
    const url = new URL('/storage/v1/object/authenticated/' + bucket + '/' + encodeURIComponent(name), config.supabaseUrl);
    const response = await fetch(url, {
      headers: { apikey: config.publishableKey, Authorization: 'Bearer ' + accessToken },
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal,
    });
    if (response.status === 401 || response.status === 403) {
      throw new Error('Your Ekklo account could not be verified. Sign in again and retry.');
    }
    if (!response.ok) throw new Error('The download could not be completed. Please try again.');

    const blob = await response.blob();
    if (blob.size !== Math.min(partBytes, release.bytes - received)) {
      throw new Error('The download was incomplete. Please try again.');
    }
    parts.push(blob);
    received += blob.size;
    onProgress(Math.round(received * 100 / release.bytes));
  }
  return new Blob(parts, { type: release.contentType });
}
