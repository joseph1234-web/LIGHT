export const presenterHome = 'https://joseph1234-web.github.io/LIGHT/';
export const presenterContactEmail = 'sepher1800@gmail.com';
export const presenterProEmail = `mailto:${presenterContactEmail}?subject=Ekklo.%20Pro%20purchase%20request`;

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
    version: '1.17.0',
    fileName: 'Ekklo_Android_1.17.0.apk',
    format: 'APK',
    contentType: 'application/vnd.android.package-archive',
    bytes: 149_698_468,
  },
} as const;

export type PresenterPlatform = keyof typeof presenterReleases;

export function presenterPlatform(value: string | null): PresenterPlatform | null {
  return value === 'windows' || value === 'android' ? value : null;
}
