# Coach voice plugin

Local Tauri plugin that gives the Coach a voice on Android. The Android WebView has no `speechSynthesis`, so the app
calls Android's `TextToSpeech` through this plugin instead.

- Picks a male voice by id (Google's are not labelled; `es-US` `esd`/`esf` and `es-ES` `eed`/`eef` were measured male
  by pitch), Latin American first, local voices first so the line starts without a network round trip.
- The engine and the male Spanish voice are warmed when the app loads.
- `speak` resolves when the sound starts and returns `latencyMs` (tap to sound). If the engine does not start within
  6 s it is restarted and the call is rejected with `TIMEOUT`; `NO_VOICE` means no engine or no voice for the language.
- `open_settings` opens Android's text-to-speech settings.
- `schedule_speak` / `cancel_scheduled`: the rest-end line. The WebView sleeps with the screen locked, so the app
  hands the line to an exact alarm (`USE_EXACT_ALARM`) when the rest starts; `RestSpeechReceiver` says it with the
  phone's male voice, or keeps quiet when the app is in front (the app then says it with the voice the user chose).
