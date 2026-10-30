const COMMANDS: &[&str] = &["can_install_packages", "get_installed_version", "open_install_settings", "download_and_install"];

fn main() {
  tauri_plugin::Builder::new(COMMANDS)
    .android_path("android")
    .ios_path("ios")
    .build();
}
