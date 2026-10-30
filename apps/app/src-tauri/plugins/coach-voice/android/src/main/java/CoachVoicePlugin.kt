package com.gymup.coachvoice

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import android.os.SystemClock
import android.util.Log
import android.webkit.WebView
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSArray
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.util.Locale
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

private const val TAG = "CoachVoice"
// If the engine has not started talking by then (it can die mid-request), the app is told and the engine restarted.
private const val START_TIMEOUT_MS = 6000L

@InvokeArg
class LangArgs {
  var lang: String = "es"
}

@InvokeArg
class SpeakArgs {
  lateinit var text: String
  var lang: String = "es"
  /** A voice the user picked in Settings; the best male one when missing or no longer installed. */
  var voice: String? = null
}

// Android does not say which voices are male. Engines that do put it in the name ("#male_1") or the features;
// the others are matched by the ids of known male voices. Google's were measured by pitch on its own samples
// (2026-10-30): es-US esd/esf and es-ES eed/eef are male; es-US sfb (the default) and esc, es-ES eea/eec/eee are
// female. Without a male voice, the default voice of the language speaks lower and the app is told so.
private val MALE = Regex(
  "(?<!fe)male|hombre|masculin|es-us-x-es[df]|es-es-x-ee[df]|en-us-x-io[lm]|en-us-x-tpd|en-gb-x-gbd|en-gb-x-rjs|smtm\\d",
  RegexOption.IGNORE_CASE,
)
private val FEMALE = Regex("female|mujer|femenin|smtl\\d|smtf\\d", RegexOption.IGNORE_CASE)

private val COUNTRIES = mapOf(
  "es" to listOf("VE", "419", "US", "MX", "CO", "AR", "ES"),
  "en" to listOf("US", "GB", "AU"),
)

@TauriPlugin
class CoachVoicePlugin(private val activity: Activity) : Plugin(activity) {
  private var tts: TextToSpeech? = null
  // null while starting, then whether the engine came up.
  @Volatile private var ready: Boolean? = null
  private val waiting = mutableListOf<() -> Unit>()
  private val pending = ConcurrentHashMap<String, Invoke>()
  // When each utterance was asked for, to measure tap-to-sound latency.
  private val askedAt = ConcurrentHashMap<String, Long>()
  private val main = Handler(Looper.getMainLooper())
  private val worker = java.util.concurrent.Executors.newSingleThreadExecutor()
  // What each utterance resolves with (voice picked), built when it is queued so starting stays cheap.
  private val results = ConcurrentHashMap<String, JSObject>()

  // Start the engine as soon as the app loads: binding to it takes a moment that the first line should not pay.
  override fun load(webView: WebView) {
    super.load(webView)
    withEngine { engine ->
      Log.i(TAG, "engine warm: ${engine != null}")
      if (engine != null) worker.execute { warmVoice(engine) }
    }
  }

  /** Google lists its voices a moment after binding: wait for the language's voices (up to 1.5 s). */
  private fun awaitVoices(engine: TextToSpeech, lang: String): List<Voice> {
    repeat(10) {
      val v = voicesFor(engine, lang)
      if (v.isNotEmpty()) return v
      SystemClock.sleep(150)
    }
    return voicesFor(engine, lang)
  }

  // Loads the male Spanish voice into memory with a silent synthesis, so the first real line starts at once.
  private fun warmVoice(engine: TextToSpeech) {
    awaitVoices(engine, "es")
    val voice = pick(engine, "es") ?: return
    engine.voice = voice
    val f = java.io.File(activity.cacheDir, "coach-warm.wav")
    engine.synthesizeToFile(".", Bundle(), f, "warm-${UUID.randomUUID()}")
    Log.i(TAG, "warmed ${voice.name}")
  }

  private fun withEngine(block: (TextToSpeech?) -> Unit) {
    synchronized(waiting) {
      when (ready) {
        true -> return block(tts)
        false -> return block(null)
        null -> {
          waiting.add { block(if (ready == true) tts else null) }
          if (tts != null) return
        }
      }
    }
    tts = TextToSpeech(activity.applicationContext) { status ->
      val ok = status == TextToSpeech.SUCCESS
      Log.i(TAG, "engine init status=$status engine=${tts?.defaultEngine}")
      if (ok) tts?.setOnUtteranceProgressListener(listener)
      val run = synchronized(waiting) {
        ready = ok
        waiting.toList().also { waiting.clear() }
      }
      run.forEach { it() }
    }
  }

  private val listener = object : UtteranceProgressListener() {
    // Resolves as soon as the sound starts: the app learns the tap-to-sound time and never waits for the whole line.
    override fun onStart(utteranceId: String) {
      val asked = askedAt.remove(utteranceId) ?: return
      val ms = SystemClock.elapsedRealtime() - asked
      Log.i(TAG, "speech started after ${ms} ms")
      val result = results.remove(utteranceId) ?: JSObject()
      pending.remove(utteranceId)?.resolve(result.put("latencyMs", ms.toInt()))
    }
    override fun onDone(utteranceId: String) {}
    @Deprecated("Deprecated in Java")
    override fun onError(utteranceId: String) {
      pending.remove(utteranceId)?.reject("El motor de voz no pudo hablar")
    }
    override fun onError(utteranceId: String, errorCode: Int) {
      Log.w(TAG, "speak error $errorCode")
      pending.remove(utteranceId)?.reject("El motor de voz no pudo hablar (código $errorCode)")
      askedAt.remove(utteranceId)
      results.remove(utteranceId)
    }
    override fun onStop(utteranceId: String, interrupted: Boolean) {
      askedAt.remove(utteranceId)
      pending.remove(utteranceId)?.resolve(results.remove(utteranceId) ?: JSObject())
    }
  }

  private var currentLang = "es"

  private fun voicesFor(engine: TextToSpeech, lang: String): List<Voice> =
    try {
      (engine.voices ?: emptySet()).filter {
        it.locale.language == lang &&
          !it.features.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)
      }
    } catch (e: Exception) {
      Log.w(TAG, "voices failed", e)
      emptyList()
    }

  private fun isMale(v: Voice): Boolean {
    val label = "${v.name} ${v.features.joinToString(" ")}"
    return MALE.containsMatchIn(label) && !FEMALE.containsMatchIn(label)
  }

  /** Male first, then Venezuelan / Latin American, then voices that work offline, then quality. */
  private fun pick(engine: TextToSpeech, lang: String): Voice? {
    val countries = COUNTRIES[lang] ?: emptyList()
    fun countryRank(v: Voice): Int {
      val c = v.locale.country.ifEmpty { v.locale.variant }
      val i = countries.indexOf(c.uppercase(Locale.ROOT))
      return if (i < 0) countries.size else i
    }
    return voicesFor(engine, lang).sortedWith(
      // Local voices first: no network round trip, so the line starts right after the tap.
      compareBy<Voice>({ if (isMale(it)) 0 else 1 }, { countryRank(it) }, { if (it.isNetworkConnectionRequired) 1 else 0 }, { -it.quality }),
    ).firstOrNull()
  }

  private fun statusOf(lang: String): JSObject {
    val result = JSObject()
    val engine = tts
    if (ready != true || engine == null) {
      result.put("available", false)
      result.put("male", false)
      result.put("voices", JSArray())
      return result
    }
    val voice = pick(engine, lang)
    result.put("available", voice != null || engine.isLanguageAvailable(Locale(lang)) >= TextToSpeech.LANG_AVAILABLE)
    result.put("male", voice?.let(::isMale) ?: false)
    result.put("voice", voice?.name)
    result.put("engine", engine.defaultEngine)
    // One entry per voice (Google lists each twice, local and network), male ones first, for the picker in Settings.
    val list = JSArray()
    voicesFor(engine, lang)
      .filter { !it.isNetworkConnectionRequired }
      .sortedWith(compareBy<Voice>({ if (isMale(it)) 0 else 1 }, { it.locale.toString() }, { it.name }))
      .forEach {
        val o = JSObject()
        o.put("name", it.name)
        o.put("locale", it.locale.toLanguageTag())
        o.put("male", isMale(it))
        list.put(o)
      }
    result.put("voices", list)
    return result
  }

  private fun restartEngine() {
    synchronized(waiting) {
      try { tts?.shutdown() } catch (_: Exception) {}
      tts = null
      ready = null
    }
    withEngine { Log.i(TAG, "engine restarted: ${it != null}") }
  }

  @Command
  fun status(invoke: Invoke) {
    val args = invoke.parseArgs(LangArgs::class.java)
    withEngine { invoke.resolve(statusOf(args.lang)) }
  }

  @Command
  fun speak(invoke: Invoke) {
    val asked = SystemClock.elapsedRealtime()
    val args = invoke.parseArgs(SpeakArgs::class.java)
    withEngine { engine -> worker.execute { speakNow(invoke, args, asked, engine) } }
  }

  // Off the main thread: waiting for the voice list must not freeze the screen.
  private fun speakNow(invoke: Invoke, args: SpeakArgs, asked: Long, engine: TextToSpeech?) {
    run {
      if (engine == null) {
        invoke.reject("NO_VOICE: este teléfono no tiene un motor de texto a voz activo")
        return
      }
      currentLang = args.lang
      awaitVoices(engine, args.lang)
      val chosen = args.voice?.let { name -> voicesFor(engine, args.lang).firstOrNull { it.name == name } }
      val voice = chosen ?: pick(engine, args.lang)
      if (voice != null) {
        engine.voice = voice
      } else if (engine.setLanguage(Locale(args.lang)) < TextToSpeech.LANG_AVAILABLE) {
        invoke.reject("NO_VOICE: no hay voz instalada para el idioma ${args.lang}")
        return
      }
      // No male voice: the default one, deeper. A voice the user chose is left as it sounds.
      engine.setPitch(if (chosen != null || (voice != null && isMale(voice))) 1.0f else 0.8f)
      engine.setSpeechRate(1.05f)
      val id = UUID.randomUUID().toString()
      results[id] = JSObject()
        .put("available", true)
        .put("male", voice?.let(::isMale) ?: false)
        .put("voice", voice?.name)
        .put("engine", engine.defaultEngine)
        .put("voices", JSArray())
      pending[id] = invoke
      askedAt[id] = asked
      main.postDelayed({
        pending.remove(id)?.let {
          askedAt.remove(id)
          results.remove(id)
          Log.w(TAG, "engine did not start within ${START_TIMEOUT_MS} ms; restarting it")
          it.reject("TIMEOUT: el motor de voz no respondió")
          restartEngine()
        }
      }, START_TIMEOUT_MS)
      val code = engine.speak(args.text, TextToSpeech.QUEUE_FLUSH, Bundle(), id)
      Log.i(TAG, "speak voice=${voice?.name} male=${voice?.let(::isMale)} code=$code")
      if (code != TextToSpeech.SUCCESS) {
        pending.remove(id)
        askedAt.remove(id)
        invoke.reject("El motor de voz rechazó la frase")
      }
    }
  }

  @Command
  fun stop(invoke: Invoke) {
    tts?.stop()
    invoke.resolve()
  }

  /** Android's text-to-speech settings, to install or pick a voice. */
  @Command
  fun openSettings(invoke: Invoke) {
    try {
      activity.startActivity(Intent("com.android.settings.TTS_SETTINGS").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    } catch (e: Exception) {
      activity.startActivity(Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
    invoke.resolve()
  }
}
