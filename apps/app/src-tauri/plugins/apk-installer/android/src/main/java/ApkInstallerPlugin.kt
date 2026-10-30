package com.gymup.apkinstaller

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.Locale
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

private const val MAX_APK_BYTES = 25L * 1024 * 1024
private const val APK_MIME = "application/vnd.android.package-archive"

@InvokeArg
class DownloadArgs {
  lateinit var url: String
  lateinit var sha256: String
}

@TauriPlugin
class ApkInstallerPlugin(private val activity: Activity) : Plugin(activity) {
  private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

  @Command
  fun canInstallPackages(invoke: Invoke) {
    val allowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
      activity.packageManager.canRequestPackageInstalls()
    val result = JSObject()
    result.put("allowed", allowed)
    invoke.resolve(result)
  }

  @Command
  fun getInstalledVersion(invoke: Invoke) {
    val info = activity.packageManager.getPackageInfo(activity.packageName, 0)
    val result = JSObject()
    result.put("versionName", info.versionName ?: "")
    result.put("versionCode", if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode else info.versionCode.toLong())
    invoke.resolve(result)
  }

  @Command
  fun openInstallSettings(invoke: Invoke) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
        data = Uri.parse("package:${activity.packageName}")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      activity.startActivity(intent)
    }
    invoke.resolve()
  }

  @Command
  fun downloadAndInstall(invoke: Invoke) {
    val args = invoke.parseArgs(DownloadArgs::class.java)
    if (!args.url.startsWith("https://", ignoreCase = true)) {
      invoke.reject("La descarga de actualizaciones debe usar HTTPS")
      return
    }
    if (!args.sha256.matches(Regex("^[a-fA-F0-9]{64}$"))) {
      invoke.reject("El hash de la actualización no es válido")
      return
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !activity.packageManager.canRequestPackageInstalls()) {
      invoke.reject("Concede a Gym Up permiso para instalar APKs y vuelve a intentarlo")
      return
    }

    scope.launch {
      try {
        val apk = downloadVerifiedApk(args.url, args.sha256)
        activity.runOnUiThread {
          try {
            val uri = FileProvider.getUriForFile(
              activity,
              "${activity.packageName}.fileprovider",
              apk,
            )
            val intent = Intent(Intent.ACTION_VIEW).apply {
              setDataAndType(uri, APK_MIME)
              addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            activity.startActivity(intent)
            invoke.resolve()
          } catch (error: Exception) {
            invoke.reject(error.message ?: "No se pudo abrir el instalador de Android")
          }
        }
      } catch (error: Exception) {
        invoke.reject(error.message ?: "No se pudo descargar la actualización")
      }
    }
  }

  private fun downloadVerifiedApk(source: String, expectedHash: String): File {
    val connection = URL(source).openConnection() as HttpURLConnection
    connection.connectTimeout = 15_000
    connection.readTimeout = 30_000
    connection.instanceFollowRedirects = true
    connection.setRequestProperty("Accept", APK_MIME)
    try {
      connection.connect()
      if (connection.responseCode !in 200..299) {
        throw IllegalStateException("El servidor respondió ${connection.responseCode} al descargar la actualización")
      }
      if (!connection.url.protocol.equals("https", ignoreCase = true) || !connection.url.host.equals(URL(source).host, ignoreCase = true)) {
        throw IllegalStateException("El servidor redirigió la descarga a un origen no permitido")
      }
      val declaredLength = connection.contentLengthLong
      if (declaredLength > MAX_APK_BYTES) throw IllegalStateException("La APK supera el tamaño permitido")

      val updates = File(activity.cacheDir, "updates").apply { mkdirs() }
      val partial = File(updates, "gym-up.apk.part")
      val apk = File(updates, "gym-up.apk")
      val digest = MessageDigest.getInstance("SHA-256")
      var total = 0L
      var lastProgressAt = 0L
      connection.inputStream.use { input ->
        partial.outputStream().use { output ->
          val buffer = ByteArray(32 * 1024)
          while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            total += count
            if (total > MAX_APK_BYTES) throw IllegalStateException("La APK supera el tamaño permitido")
            digest.update(buffer, 0, count)
            output.write(buffer, 0, count)
            val now = System.currentTimeMillis()
            if (now - lastProgressAt >= 300 || (declaredLength > 0 && total >= declaredLength)) {
              val progress = JSObject().apply {
                put("downloaded", total)
                put("total", declaredLength)
              }
              trigger("downloadProgress", progress)
              lastProgressAt = now
            }
          }
        }
      }
      val actualHash = digest.digest().joinToString("") { "%02x".format(Locale.ROOT, it.toInt() and 0xff) }
      if (!actualHash.equals(expectedHash, ignoreCase = true)) {
        partial.delete()
        throw IllegalStateException("La APK descargada no coincide con su firma de integridad")
      }
      apk.delete()
      if (!partial.renameTo(apk)) throw IllegalStateException("No se pudo guardar la APK descargada")
      return apk
    } finally {
      connection.disconnect()
    }
  }
}
