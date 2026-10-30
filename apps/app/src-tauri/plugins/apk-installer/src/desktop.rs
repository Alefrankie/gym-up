use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::*;

pub fn init<R: Runtime, C: DeserializeOwned>(
  app: &AppHandle<R>,
  _api: PluginApi<R, C>,
) -> crate::Result<ApkInstaller<R>> {
  Ok(ApkInstaller(app.clone()))
}

/// Access to the apk-installer APIs.
pub struct ApkInstaller<R: Runtime>(AppHandle<R>);

impl<R: Runtime> ApkInstaller<R> {
  pub fn can_install_packages(&self) -> crate::Result<bool> {
    Ok(false)
  }

  pub fn get_installed_version(&self) -> crate::Result<InstalledVersion> {
    Err(crate::Error::UnsupportedPlatform)
  }

  pub fn open_install_settings(&self) -> crate::Result<()> {
    Ok(())
  }

  pub fn download_and_install(&self, _payload: DownloadRequest) -> crate::Result<()> {
    Err(crate::Error::UnsupportedPlatform)
  }
}
