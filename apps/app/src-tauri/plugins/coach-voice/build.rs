const COMMANDS: &[&str] = &["status", "speak", "stop", "open_settings", "schedule_speak", "cancel_scheduled"];

fn main() {
  tauri_plugin::Builder::new(COMMANDS)
    .android_path("android")
    .build();
}
