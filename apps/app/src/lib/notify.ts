// Rest timer alerts. While the screen is off the WebView is suspended and its JavaScript timer stops, so on
// Android the end of the rest is scheduled as a local notification handled by the OS (tauri-plugin-notification).
// On the web build these functions do nothing and the on-screen timer plus vibration are used.

const REST_NOTIFICATION_ID = 7001;

const inTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function plugin() {
  return import('@tauri-apps/plugin-notification');
}

/** Asks for the notification permission once (Android 13 and later). Safe to call repeatedly. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!inTauri()) return false;
  try {
    const { isPermissionGranted, requestPermission } = await plugin();
    if (await isPermissionGranted()) return true;
    return (await requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

export async function scheduleRestEnd(seconds: number): Promise<void> {
  if (!inTauri()) return;
  try {
    if (!(await ensureNotificationPermission())) return;
    const { sendNotification, Schedule, cancel } = await plugin();
    await cancel([REST_NOTIFICATION_ID]).catch(() => {});
    sendNotification({
      id: REST_NOTIFICATION_ID,
      title: 'Descanso terminado',
      body: 'Es hora de tu siguiente serie.',
      schedule: Schedule.at(new Date(Date.now() + seconds * 1000), false, true),
    });
  } catch {
    /* alerts are a convenience: never break logging a set */
  }
}

export async function cancelRestEnd(): Promise<void> {
  if (!inTauri()) return;
  try {
    const { cancel } = await plugin();
    await cancel([REST_NOTIFICATION_ID]);
  } catch {
    /* ignore */
  }
}

export function vibrateRestEnd(): void {
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    /* not supported */
  }
}
