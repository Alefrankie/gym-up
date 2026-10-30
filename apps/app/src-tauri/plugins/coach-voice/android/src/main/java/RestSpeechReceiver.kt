package com.gymup.coachvoice

import android.app.ActivityManager
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import java.util.concurrent.Executors

private const val TAG = "CoachVoice"
private const val REQUEST_CODE = 7002
private const val EXTRA_TEXT = "text"
private const val EXTRA_LANG = "lang"
private const val EXTRA_VOICE = "voice"
// A broadcast may run for 10 s; give the engine a little less to bind, speak and finish.
private const val GIVE_UP_MS = 9000L

/**
 * Says the rest-end line when the rest timer runs out while the app is in the background or the screen is locked.
 * The WebView's timers are suspended then, so the app schedules this alarm when the rest starts. When the app is in
 * the foreground it speaks the line itself (with the voice the user chose), so this receiver keeps quiet.
 */
class RestSpeechReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (appInForeground()) {
      Log.i(TAG, "rest end: app in front, it speaks itself")
      return
    }
    val text = intent.getStringExtra(EXTRA_TEXT) ?: return
    val lang = intent.getStringExtra(EXTRA_LANG) ?: "es"
    val wanted = intent.getStringExtra(EXTRA_VOICE)
    val result = goAsync()
    val main = Handler(Looper.getMainLooper())
    val worker = Executors.newSingleThreadExecutor()
    var tts: TextToSpeech? = null
    var finished = false
    fun finish() {
      synchronized(this) {
        if (finished) return
        finished = true
      }
      try { tts?.shutdown() } catch (_: Exception) {}
      worker.shutdown()
      result.finish()
    }
    main.postDelayed({ finish() }, GIVE_UP_MS)
    tts = TextToSpeech(context.applicationContext) { status ->
      val engine = tts
      if (status != TextToSpeech.SUCCESS || engine == null) return@TextToSpeech finish()
      worker.execute {
        if (CoachVoices.apply(engine, lang, wanted) == null) return@execute finish()
        engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
          override fun onStart(utteranceId: String) {}
          override fun onDone(utteranceId: String) = finish()
          @Deprecated("Deprecated in Java")
          override fun onError(utteranceId: String) = finish()
        })
        val code = engine.speak(text, TextToSpeech.QUEUE_FLUSH, Bundle(), "rest-end")
        Log.i(TAG, "rest end spoken in the background: voice=${engine.voice?.name} code=$code")
        if (code != TextToSpeech.SUCCESS) finish()
      }
    }
  }

  private fun appInForeground(): Boolean {
    val state = ActivityManager.RunningAppProcessInfo()
    ActivityManager.getMyMemoryState(state)
    return state.importance <= ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
  }

  companion object {
    private fun pending(context: Context, intent: Intent?): PendingIntent? {
      val flags = PendingIntent.FLAG_IMMUTABLE or (if (intent == null) PendingIntent.FLAG_NO_CREATE else PendingIntent.FLAG_UPDATE_CURRENT)
      return PendingIntent.getBroadcast(context, REQUEST_CODE, intent ?: Intent(context, RestSpeechReceiver::class.java), flags)
    }

    /** Schedules the line for `atMs` (wall clock), replacing any previous one. Exact when Android allows it. */
    fun schedule(context: Context, atMs: Long, text: String, lang: String, voice: String?) {
      val intent = Intent(context, RestSpeechReceiver::class.java)
        .putExtra(EXTRA_TEXT, text)
        .putExtra(EXTRA_LANG, lang)
        .putExtra(EXTRA_VOICE, voice)
      val pi = pending(context, intent) ?: return
      val alarms = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarms.canScheduleExactAlarms()) {
        alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, pi)
      } else {
        alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, pi)
      }
      Log.i(TAG, "rest end line scheduled in ${atMs - System.currentTimeMillis()} ms")
    }

    fun cancel(context: Context) {
      val pi = pending(context, null) ?: return
      (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager).cancel(pi)
      pi.cancel()
    }
  }
}
