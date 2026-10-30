import { addPluginListener, invoke, isTauri } from '@tauri-apps/api/core';

type InstalledVersion = { versionCode: number; versionName: string };
type UpdateManifest = {
  version: string;
  versionCode: number;
  apkUrl: string;
  sha256: string;
  releaseNotes?: string;
};
type DownloadProgress = { downloaded: number; total: number };

const UPDATE_BASE_URL = import.meta.env.VITE_UPDATE_BASE_URL || 'https://gym-up-web.gymup-phase0-spike.workers.dev';
const DISMISSED_VERSION_KEY = 'gymup.update.dismissed-version';

class AppUpdates {
  supported = $state(false);
  available = $state<UpdateManifest | null>(null);
  dismissed = $state(false);
  checking = $state(false);
  checked = $state(false);
  error = $state(false);
  downloading = $state(false);
  downloaded = $state(0);
  downloadSize = $state(0);
  permissionRequired = $state(false);
  installedVersion = $state('');
  errorDetail = $state('');

  get progressPercent() {
    return this.downloadSize > 0 ? Math.min(100, Math.floor((this.downloaded / this.downloadSize) * 100)) : null;
  }

  async check(manual = false) {
    if (this.checking) return;
    if (!isTauri() || !/Android/i.test(navigator.userAgent)) {
      this.checked = true;
      return;
    }
    this.supported = true;
    this.checking = true;
    this.error = false;
    try {
      const installed = await invoke<InstalledVersion>('plugin:apk-installer|get_installed_version');
      this.installedVersion = installed.versionName;
      const response = await fetch(new URL('/update.json', UPDATE_BASE_URL), {
        cache: 'no-store',
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) throw new Error(`Update check returned HTTP ${response.status}`);
      const manifest = await response.json() as UpdateManifest;
      this.validateManifest(manifest);
      const dismissed = this.readDismissedVersion();
      this.available = manifest.versionCode > installed.versionCode ? manifest : null;
      this.dismissed = Boolean(this.available && dismissed === String(manifest.versionCode));
      if (manual && !this.available) this.checked = true;
    } catch {
      this.error = manual;
    } finally {
      this.checking = false;
      this.checked = true;
    }
  }

  dismiss() {
    try {
      if (this.available) localStorage.setItem(DISMISSED_VERSION_KEY, String(this.available.versionCode));
    } catch {
      // Dismissal is a convenience; restricted storage should not block the app.
    }
    this.dismissed = true;
  }

  async install() {
    const manifest = this.available;
    if (!manifest || this.downloading) return;

    try {
      // The plugin resolves { allowed }, not a bare boolean.
      const { allowed } = await invoke<{ allowed: boolean }>('plugin:apk-installer|can_install_packages');
      if (!allowed) {
        this.permissionRequired = true;
        await invoke('plugin:apk-installer|open_install_settings');
        return;
      }

      this.permissionRequired = false;
      this.error = false;
      this.errorDetail = '';
      this.downloading = true;
      this.downloaded = 0;
      this.downloadSize = 0;
      let unlisten: { unregister: () => Promise<void> } | undefined;
      try {
        unlisten = await addPluginListener<DownloadProgress>('apk-installer', 'downloadProgress', ({ downloaded, total }) => {
          this.downloaded = downloaded;
          this.downloadSize = total;
        });
        const apkUrl = new URL(manifest.apkUrl, UPDATE_BASE_URL);
        if (apkUrl.origin !== new URL(UPDATE_BASE_URL).origin || apkUrl.protocol !== 'https:') {
          throw new Error('Update APK URL must use the configured HTTPS origin');
        }
        await invoke('plugin:apk-installer|download_and_install', {
          url: apkUrl.toString(),
          sha256: manifest.sha256,
        });
      } finally {
        await unlisten?.unregister();
      }
    } catch (error) {
      this.error = true;
      this.errorDetail = typeof error === 'string' ? error : error instanceof Error ? error.message : '';
    } finally {
      this.downloading = false;
    }
  }

  private validateManifest(value: UpdateManifest) {
    if (
      !value ||
      typeof value.version !== 'string' ||
      !Number.isSafeInteger(value.versionCode) ||
      value.versionCode < 1 ||
      typeof value.apkUrl !== 'string' ||
      !/^\/[a-zA-Z0-9/._-]+\.apk$/.test(value.apkUrl) ||
      typeof value.sha256 !== 'string' ||
      !/^[a-fA-F0-9]{64}$/.test(value.sha256)
    ) {
      throw new Error('Invalid update manifest');
    }
  }

  private readDismissedVersion() {
    try {
      return localStorage.getItem(DISMISSED_VERSION_KEY);
    } catch {
      return null;
    }
  }
}

export const appUpdates = new AppUpdates();
