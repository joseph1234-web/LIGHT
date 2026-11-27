export const presenterHome = 'https://joseph1234-web.github.io/LIGHT/';

export const presenterReleases = {
  windows: {
    platform: 'Windows',
    version: '1.16.0',
    fileName: 'Ekklo_Setup_1.16.0.exe',
    format: 'EXE installer',
    contentType: 'application/octet-stream',
    bytes: 66_368_749,
  },
  android: {
    platform: 'Android',
    version: '1.15.0',
    fileName: 'Ekklo_Android_1.15.0.apk',
    format: 'APK',
    contentType: 'application/vnd.android.package-archive',
    bytes: 149_759_316,
  },
} as const;

export type PresenterPlatform = keyof typeof presenterReleases;

export function presenterPlatform(value: string | null): PresenterPlatform | null {
  return value === 'windows' || value === 'android' ? value : null;
}
