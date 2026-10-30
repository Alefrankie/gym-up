use tauri::{AppHandle, Runtime, command};

use crate::{ApkInstallerExt, DownloadRequest, Result};

#[command]
pub(crate) async fn can_install_packages<R: Runtime>(app: AppHandle<R>) -> Result<bool> {
  app.apk_installer().can_install_packages()
}

#[command]
pub(crate) async fn get_installed_version<R: Runtime>(app: AppHandle<R>) -> Result<crate::InstalledVersion> {
  app.apk_installer().get_installed_version()
}

#[command]
pub(crate) async fn open_install_settings<R: Runtime>(app: AppHandle<R>) -> Result<()> {
  app.apk_installer().open_install_settings()
}

#[command]
pub(crate) async fn download_and_install<R: Runtime>(
  app: AppHandle<R>,
  url: String,
  sha256: String,
) -> Result<()> {
  app.apk_installer().download_and_install(DownloadRequest { url, sha256 })
}
