use tauri::{AppHandle, Runtime, command};

use crate::{CoachVoiceExt, Result, ScheduleRequest, SpeakRequest, VoiceStatus};

#[command]
pub(crate) async fn status<R: Runtime>(app: AppHandle<R>, lang: String) -> Result<VoiceStatus> {
  app.coach_voice().status(lang)
}

#[command]
pub(crate) async fn speak<R: Runtime>(
  app: AppHandle<R>,
  text: String,
  lang: String,
  voice: Option<String>,
) -> Result<VoiceStatus> {
  app.coach_voice().speak(SpeakRequest { text, lang, voice })
}

#[command]
pub(crate) async fn schedule_speak<R: Runtime>(
  app: AppHandle<R>,
  text: String,
  lang: String,
  voice: Option<String>,
  at_ms: i64,
) -> Result<()> {
  app.coach_voice().schedule_speak(ScheduleRequest { text, lang, voice, at_ms })
}

#[command]
pub(crate) async fn cancel_scheduled<R: Runtime>(app: AppHandle<R>) -> Result<()> {
  app.coach_voice().cancel_scheduled()
}

#[command]
pub(crate) async fn stop<R: Runtime>(app: AppHandle<R>) -> Result<()> {
  app.coach_voice().stop()
}

#[command]
pub(crate) async fn open_settings<R: Runtime>(app: AppHandle<R>) -> Result<()> {
  app.coach_voice().open_settings()
}
