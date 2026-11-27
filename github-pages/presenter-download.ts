import { presenterReleases, type PresenterPlatform } from '../lib/presenter-releases';
import type { StandaloneConfig } from '../lib/public-paths';

const bucket = 'ekklo-presenter-downloads';
const partBytes = 40 * 1024 * 1024;

async function androidDownloadLinks(
  config: StandaloneConfig,
  accessToken: string,
  license: string,
  signal: AbortSignal,
): Promise<string[]> {
  const release = presenterReleases.android;
  const project = new URL(config.supabaseUrl);
  const response = await fetch(new URL('/functions/v1/ekklo-presenter-download', project), {
    method: 'POST',
    headers: {
      apikey: config.publishableKey,
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ license }),
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'error',
    signal,
  });
  if (response.status === 401) throw new Error('Sign in to your verified Ekklo account and try again.');
  if (response.status === 400 || response.status === 403) {
    throw new Error('Enter a valid Ekklo. Pro license key to download the Android APK.');
  }
  if (response.status === 429) throw new Error('Too many attempts. Wait a minute and try again.');
  if (!response.ok) throw new Error('The license check is temporarily unavailable. Try again.');

  const result = await response.json();
  if (!result || typeof result !== 'object' ||
      !('fileName' in result) || !('bytes' in result) || !('urls' in result) ||
      result.fileName !== release.fileName || result.bytes !== release.bytes ||
      !Array.isArray(result.urls) || result.urls.length !== Math.ceil(release.bytes / partBytes)) {
    throw new Error('Reload this page to get the current Android download.');
  }
  return result.urls.map((value: unknown, index: number) => {
    if (typeof value !== 'string') throw new Error('The download link is invalid.');
    const url = new URL(value);
    const expected = '/storage/v1/object/sign/' + bucket + '/' +
      release.fileName + '.part-' + String(index).padStart(2, '0') + '.bin';
    if (url.origin !== project.origin || url.pathname !== expected || !url.searchParams.has('token')) {
      throw new Error('The download link is invalid.');
    }
    return url.href;
  });
}

export async function fetchPresenterInstaller(
  config: StandaloneConfig,
  platform: PresenterPlatform,
  accessToken: string,
  onProgress: (percent: number) => void,
  signal: AbortSignal,
  license = '',
): Promise<Blob> {
  if (!accessToken) throw new Error('Sign in to Ekklo to download the app.');

  const release = presenterReleases[platform];
  const signedLinks = platform === 'android'
    ? await androidDownloadLinks(config, accessToken, license, signal)
    : null;
  const parts: Blob[] = [];
  let received = 0;
  for (let part = 0; received < release.bytes; part += 1) {
    const name = release.fileName + '.part-' + String(part).padStart(2, '0') + '.bin';
    const url = signedLinks?.[part] ??
      new URL('/storage/v1/object/authenticated/' + bucket + '/' + encodeURIComponent(name), config.supabaseUrl);
    const response = await fetch(url, {
      headers: signedLinks ? undefined : {
        apikey: config.publishableKey,
        Authorization: 'Bearer ' + accessToken,
      },
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal,
    });
    if (response.status === 401 || response.status === 403) {
      if (signedLinks) throw new Error('The download link expired. Verify your license again.');
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
