use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::*;

pub fn init<R: Runtime, C: DeserializeOwned>(
  app: &AppHandle<R>,
  _api: PluginApi<R, C>,
) -> crate::Result<CoachVoice<R>> {
  Ok(CoachVoice(app.clone()))
}

/// Desktop builds have no native voice: the web app uses the browser's speech instead.
pub struct CoachVoice<R: Runtime>(AppHandle<R>);

impl<R: Runtime> CoachVoice<R> {
  pub fn status(&self, _lang: String) -> crate::Result<VoiceStatus> {
    Ok(VoiceStatus::default())
  }

  pub fn speak(&self, _payload: SpeakRequest) -> crate::Result<VoiceStatus> {
    Err(crate::Error::UnsupportedPlatform)
  }

  pub fn stop(&self) -> crate::Result<()> {
    Ok(())
  }

  pub fn open_settings(&self) -> crate::Result<()> {
    Err(crate::Error::UnsupportedPlatform)
  }
}
