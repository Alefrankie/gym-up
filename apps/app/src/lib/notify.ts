// Rest timer alerts. While the screen is off the WebView is suspended and its JavaScript timer stops, so on
// Android the end of the rest is scheduled as a local notification handled by the OS (tauri-plugin-notification).
// On the web build these functions do nothing and the on-screen timer plus vibration are used.

const REST_NOTIFICATION_ID = 7001;
const CREATINE_NOTIFICATION_ID = 7002;
const CREATINE_REMINDER_FIRST_ID = 7100;
const CREATINE_REMINDER_DAYS = 30;
const CREATINE_REMINDER_START_HOUR = 9;
const CREATINE_REMINDER_END_HOUR = 22;
const CREATINE_REMINDER_MESSAGES = [
  '¿Ya tomaste tu creatina de hoy?',
  'Un recordatorio rápido: tu creatina sigue pendiente.',
  'Si todavía no la tomaste, este es un buen momento.',
  'Tu dosis diaria de creatina te está esperando.',
  '¿Marcamos la creatina de hoy como lista?',
  'Pausa de un segundo: ¿ya tomaste la creatina?',
  'Aún queda pendiente la creatina de hoy.',
  'Cuando puedas, acuérdate de tomar tu creatina.',
  'La creatina de hoy sigue en tu lista.',
  '¿Listo para completar tu rutina de suplementos?',
  'Otro aviso amable: no olvides tu creatina.',
  'Tu recordatorio diario: comprueba si tomaste la creatina.',
];

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

/** Schedules hourly, varied creatine reminders from 09:00 through 22:00 for the next 30 days. */
export async function scheduleCreatineReminder(takenToday: boolean): Promise<boolean> {
  if (!inTauri()) return false;
  try {
    if (!(await ensureNotificationPermission())) return false;
    const { sendNotification, Schedule, cancel } = await plugin();
    const ids = Array.from({ length: CREATINE_REMINDER_DAYS * (CREATINE_REMINDER_END_HOUR - CREATINE_REMINDER_START_HOUR + 1) }, (_, i) => CREATINE_REMINDER_FIRST_ID + i);
    await cancel([CREATINE_NOTIFICATION_ID, ...ids]).catch(() => {});

    const now = new Date();
    let scheduled = 0;
    for (let dayOffset = takenToday ? 1 : 0; dayOffset < CREATINE_REMINDER_DAYS; dayOffset++) {
      for (let hour = CREATINE_REMINDER_START_HOUR; hour <= CREATINE_REMINDER_END_HOUR; hour++) {
        const at = new Date(now);
        at.setDate(now.getDate() + dayOffset);
        at.setHours(hour, 0, 0, 0);
        if (at.getTime() <= now.getTime()) continue;
        const message = CREATINE_REMINDER_MESSAGES[scheduled % CREATINE_REMINDER_MESSAGES.length];
        await sendNotification({
          id: CREATINE_REMINDER_FIRST_ID + scheduled,
          title: 'Creatina',
          body: `${message} Aviso de ${at.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} a las ${hour}:00.`,
          schedule: Schedule.at(at, false, true),
        });
        scheduled++;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export async function cancelCreatineReminder(): Promise<void> {
  if (!inTauri()) return;
  try {
    const { cancel } = await plugin();
    const ids = Array.from({ length: CREATINE_REMINDER_DAYS * (CREATINE_REMINDER_END_HOUR - CREATINE_REMINDER_START_HOUR + 1) }, (_, i) => CREATINE_REMINDER_FIRST_ID + i);
    await cancel([CREATINE_NOTIFICATION_ID, ...ids]);
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
