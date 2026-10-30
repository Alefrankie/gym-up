# Android APK installer plugin

Local Tauri plugin used by Gym Up to check Android install permission, read the installed app version, and download a SHA-256-verified APK into the app cache before opening Android's package installer.

The app calls the plugin only on Android. Android still requires the user to allow installs from Gym Up and confirm each update in the system installer.
