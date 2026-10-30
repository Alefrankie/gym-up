const COMMANDS: &[&str] = &["status", "speak", "stop", "open_settings"];

fn main() {
  tauri_plugin::Builder::new(COMMANDS)
    .android_path("android")
    .build();
}
