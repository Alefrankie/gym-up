# Coach voice plugin

Local Tauri plugin that gives the Coach a voice on Android. The Android WebView has no `speechSynthesis`, so the app
calls Android's `TextToSpeech` through this plugin instead.

- Picks a male voice by id (Google's are not labelled; `es-US` `esd`/`esf` and `es-ES` `eed`/`eef` were measured male
  by pitch), Latin American first, local voices first so the line starts without a network round trip.
- The engine and the male Spanish voice are warmed when the app loads.
- `speak` resolves when the sound starts and returns `latencyMs` (tap to sound). If the engine does not start within
  6 s it is restarted and the call is rejected with `TIMEOUT`; `NO_VOICE` means no engine or no voice for the language.
- `open_settings` opens Android's text-to-speech settings.
