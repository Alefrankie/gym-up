use tauri::{
  plugin::{Builder, TauriPlugin},
  Manager, Runtime,
};

pub use models::*;

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

mod commands;
mod error;
mod models;

pub use error::{Error, Result};

#[cfg(desktop)]
use desktop::CoachVoice;
#[cfg(mobile)]
use mobile::CoachVoice;

/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the coach-voice APIs.
pub trait CoachVoiceExt<R: Runtime> {
  fn coach_voice(&self) -> &CoachVoice<R>;
}

impl<R: Runtime, T: Manager<R>> crate::CoachVoiceExt<R> for T {
  fn coach_voice(&self) -> &CoachVoice<R> {
    self.state::<CoachVoice<R>>().inner()
  }
}

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("coach-voice")
    .invoke_handler(tauri::generate_handler![
      commands::status,
      commands::speak,
      commands::stop,
      commands::open_settings,
      commands::schedule_speak,
      commands::cancel_scheduled
    ])
    .setup(|app, api| {
      #[cfg(mobile)]
      let coach_voice = mobile::init(app, api)?;
      #[cfg(desktop)]
      let coach_voice = desktop::init(app, api)?;
      app.manage(coach_voice);
      Ok(())
    })
    .build()
}
