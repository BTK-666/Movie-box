import { Capacitor } from '@capacitor/core';
import { ScreenOrientation } from '@capacitor/screen-orientation';

/**
 * Landscape lock for fullscreen playback.
 *
 * The Capacitor plugin is the reliable path inside the Android WebView; the
 * standard Screen Orientation API is the fallback for the browser. Both are
 * wrapped because either can reject (desktop browsers, unsupported devices).
 */
export async function lockLandscape(): Promise<void> {
  try {
    await ScreenOrientation.lock({ orientation: 'landscape' });
    return;
  } catch {
    /* plugin unavailable or rejected — try the web API */
  }
  try {
    await (screen.orientation as unknown as { lock?: (o: string) => Promise<void> })?.lock?.(
      'landscape',
    );
  } catch {
    /* orientation lock unsupported; fullscreen still works */
  }
}

export async function unlockOrientation(): Promise<void> {
  try {
    await ScreenOrientation.unlock();
  } catch {
    /* ignore */
  }
  try {
    await (screen.orientation as unknown as { unlock?: () => Promise<void> })?.unlock?.();
  } catch {
    /* ignore */
  }
}

export const isNative = () => Capacitor.isNativePlatform();
