use serde::{de::DeserializeOwned, Serialize};
use tauri::{
  plugin::{PluginApi, PluginHandle},
  AppHandle, Runtime,
};

use crate::models::*;

#[derive(Serialize)]
struct LangArgs {
  lang: String,
}

// initializes the Kotlin plugin class
pub fn init<R: Runtime, C: DeserializeOwned>(
  _app: &AppHandle<R>,
  api: PluginApi<R, C>,
) -> crate::Result<CoachVoice<R>> {
  #[cfg(target_os = "android")]
  let handle = api.register_android_plugin("com.gymup.coachvoice", "CoachVoicePlugin")?;
  #[cfg(target_os = "ios")]
  let handle: PluginHandle<R> = unimplemented!("the Coach's native voice is Android only");
  Ok(CoachVoice(handle))
}

/// Android's TextToSpeech, through the Kotlin plugin.
pub struct CoachVoice<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> CoachVoice<R> {
  pub fn status(&self, lang: String) -> crate::Result<VoiceStatus> {
    self.0.run_mobile_plugin("status", LangArgs { lang }).map_err(Into::into)
  }

  pub fn speak(&self, payload: SpeakRequest) -> crate::Result<VoiceStatus> {
    self.0.run_mobile_plugin("speak", payload).map_err(Into::into)
  }

  pub fn stop(&self) -> crate::Result<()> {
    let _: () = self.0.run_mobile_plugin("stop", ())?;
    Ok(())
  }

  pub fn open_settings(&self) -> crate::Result<()> {
    let _: () = self.0.run_mobile_plugin("openSettings", ())?;
    Ok(())
  }
}
