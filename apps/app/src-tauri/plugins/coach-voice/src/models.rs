use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeakRequest {
  pub text: String,
  /// `es` or `en`.
  pub lang: String,
  /// A voice picked in Settings; the best male one when missing.
  pub voice: Option<String>,
}

/// A line to say later even if the app is in the background (rest end).
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleRequest {
  pub text: String,
  pub lang: String,
  pub voice: Option<String>,
  /// Wall-clock time, milliseconds since the epoch.
  pub at_ms: i64,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceInfo {
  pub name: String,
  pub locale: String,
  pub male: bool,
}

/// What the device can say: whether a text-to-speech engine answered, and the voice picked for the language.
#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct VoiceStatus {
  pub available: bool,
  pub male: bool,
  pub voice: Option<String>,
  pub engine: Option<String>,
  /// Installed voices for the language, male ones first, for the picker in Settings.
  pub voices: Vec<VoiceInfo>,
  /// Milliseconds from the request to the first sound (speak only).
  pub latency_ms: Option<i64>,
}
