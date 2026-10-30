use serde::de::DeserializeOwned;
use tauri::{
  plugin::{PluginApi, PluginHandle},
  AppHandle, Runtime,
};

use crate::models::*;

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_apk_installer);

// initializes the Kotlin or Swift plugin classes
pub fn init<R: Runtime, C: DeserializeOwned>(
  _app: &AppHandle<R>,
  api: PluginApi<R, C>,
) -> crate::Result<ApkInstaller<R>> {
  #[cfg(target_os = "android")]
  let handle = api.register_android_plugin("com.gymup.apkinstaller", "ApkInstallerPlugin")?;
  #[cfg(target_os = "ios")]
  let handle = api.register_ios_plugin(init_plugin_apk_installer)?;
  Ok(ApkInstaller(handle))
}

/// Access to the apk-installer APIs.
pub struct ApkInstaller<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> ApkInstaller<R> {
  pub fn can_install_packages(&self) -> crate::Result<bool> {
    let result: CanInstallResponse = self.0.run_mobile_plugin("canInstallPackages", ())?;
    Ok(result.allowed)
  }

  pub fn get_installed_version(&self) -> crate::Result<InstalledVersion> {
    self.0.run_mobile_plugin("getInstalledVersion", ()).map_err(Into::into)
  }

  pub fn open_install_settings(&self) -> crate::Result<()> {
    let _: () = self.0.run_mobile_plugin("openInstallSettings", ())?;
    Ok(())
  }

  pub fn download_and_install(&self, payload: DownloadRequest) -> crate::Result<()> {
    let _: () = self.0.run_mobile_plugin("downloadAndInstall", payload)?;
    Ok(())
  }
}
