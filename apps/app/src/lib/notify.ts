import { t } from '#lib/i18n';

// Rest timer alerts. While the screen is off the WebView is suspended and its JavaScript timer stops, so on
// Android the end of the rest is scheduled as a local notification handled by the OS (tauri-plugin-notification).
// On the web build these functions do nothing and the on-screen timer plus vibration are used.

const REST_NOTIFICATION_ID = 7001;
const CREATINE_NOTIFICATION_ID = 7002;
const WORKOUT_NOTIFICATION_ID = 7003;
const WORKOUT_TIMER_CHANNEL_ID = 'gym-up-workout-timers';
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
let workoutNotificationStartedAt: number | null = null;
let workoutNotificationGeneration = 0;

async function plugin() {
  return import('@tauri-apps/plugin-notification');
}

async function ensureWorkoutTimerChannel(api: Awaited<ReturnType<typeof plugin>>): Promise<string | undefined> {
  try {
    await api.createChannel({
      id: WORKOUT_TIMER_CHANNEL_ID,
      name: t('workout.notificationChannel'),
      description: t('workout.notificationChannelDescription'),
      importance: api.Importance.Low,
      vibration: false,
      lights: false,
    });
    return WORKOUT_TIMER_CHANNEL_ID;
  } catch {
    // Desktop builds do not use Android notification channels.
    return undefined;
  }
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
    const api = await plugin();
    const { sendNotification, Schedule, cancel } = api;
    await cancel([REST_NOTIFICATION_ID]).catch(() => {});
    const endsAt = Date.now() + seconds * 1000;
    const channelId = await ensureWorkoutTimerChannel(api);
    // Android's native chronometer keeps counting down while the WebView is asleep.
    sendNotification({
      id: REST_NOTIFICATION_ID,
      title: t('workout.rest'),
      body: t('workout.notificationNextSet'),
      ...(channelId ? { channelId } : {}),
      when: endsAt,
      usesChronometer: true,
      chronometerCountDown: true,
      ongoing: true,
      silent: true,
    });
    sendNotification({
      id: REST_NOTIFICATION_ID,
      title: t('workout.notificationRestDone'),
      body: t('workout.notificationRestDoneBody'),
      schedule: Schedule.at(new Date(endsAt), false, true),
    });
  } catch {
    /* alerts are a convenience: never break logging a set */
  }
}

export async function cancelRestEnd(): Promise<void> {
  if (!inTauri()) return;
  try {
    const { cancel, removeActive } = await plugin();
    await cancel([REST_NOTIFICATION_ID]);
    await removeActive([{ id: REST_NOTIFICATION_ID }]).catch(() => {});
  } catch {
    /* ignore */
  }
}

/** A native stopwatch in Android's notification shade; the OS keeps it running in the background. */
export async function startWorkoutNotification(startedAt: number): Promise<void> {
  if (!inTauri() || workoutNotificationStartedAt === startedAt) return;
  workoutNotificationStartedAt = startedAt;
  const generation = ++workoutNotificationGeneration;
  try {
    if (!(await ensureNotificationPermission())) {
      if (generation === workoutNotificationGeneration) workoutNotificationStartedAt = null;
      return;
    }
    if (generation !== workoutNotificationGeneration) return;
    const api = await plugin();
    const { sendNotification } = api;
    const channelId = await ensureWorkoutTimerChannel(api);
    sendNotification({
      id: WORKOUT_NOTIFICATION_ID,
      title: t('workout.notificationActive'),
      body: t('workout.notificationElapsed'),
      ...(channelId ? { channelId } : {}),
      when: startedAt,
      usesChronometer: true,
      ongoing: true,
      silent: true,
    });
  } catch {
    if (generation === workoutNotificationGeneration) workoutNotificationStartedAt = null;
  }
}

export async function cancelWorkoutNotification(startedAt: number): Promise<void> {
  if (workoutNotificationStartedAt !== startedAt) return;
  workoutNotificationStartedAt = null;
  workoutNotificationGeneration++;
  if (!inTauri()) return;
  try {
    const { removeActive } = await plugin();
    await removeActive([{ id: WORKOUT_NOTIFICATION_ID }]);
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
