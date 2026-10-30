package com.gymup.coachvoice

import android.os.SystemClock
import android.speech.tts.TextToSpeech
import android.speech.tts.Voice
import android.util.Log
import java.util.Locale

/**
 * Picking the Coach's male voice from Android's TextToSpeech, shared by the plugin (app in front) and the rest-end
 * alarm (app in the background).
 *
 * Android does not say which voices are male. Engines that do put it in the name ("#male_1") or the features;
 * the others are matched by the ids of known male voices. Google's were measured by pitch on its own samples
 * (2026-10-30): es-US esd/esf and es-ES eed/eef are male; es-US sfb (the default) and esc, es-ES eea/eec/eee are
 * female. Without a male voice, the default voice of the language speaks lower and the app is told so.
 */
object CoachVoices {
  private const val TAG = "CoachVoice"

  private val MALE = Regex(
    "(?<!fe)male|hombre|masculin|es-us-x-es[df]|es-es-x-ee[df]|en-us-x-io[lm]|en-us-x-tpd|en-gb-x-gbd|en-gb-x-rjs|smtm\\d",
    RegexOption.IGNORE_CASE,
  )
  private val FEMALE = Regex("female|mujer|femenin|smtl\\d|smtf\\d", RegexOption.IGNORE_CASE)

  private val COUNTRIES = mapOf(
    "es" to listOf("VE", "419", "US", "MX", "CO", "AR", "ES"),
    "en" to listOf("US", "GB", "AU"),
  )

  fun voicesFor(engine: TextToSpeech, lang: String): List<Voice> =
    try {
      (engine.voices ?: emptySet()).filter {
        it.locale.language == lang && !it.features.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)
      }
    } catch (e: Exception) {
      Log.w(TAG, "voices failed", e)
      emptyList()
    }

  /** Google lists its voices a moment after binding: wait for the language's voices (up to 1.5 s). */
  fun awaitVoices(engine: TextToSpeech, lang: String): List<Voice> {
    repeat(10) {
      val v = voicesFor(engine, lang)
      if (v.isNotEmpty()) return v
      SystemClock.sleep(150)
    }
    return voicesFor(engine, lang)
  }

  fun isMale(v: Voice): Boolean {
    val label = "${v.name} ${v.features.joinToString(" ")}"
    return MALE.containsMatchIn(label) && !FEMALE.containsMatchIn(label)
  }

  /** Male first, then Venezuelan / Latin American, then local voices (no network round trip), then quality. */
  fun pick(engine: TextToSpeech, lang: String): Voice? {
    val countries = COUNTRIES[lang] ?: emptyList()
    fun countryRank(v: Voice): Int {
      val c = v.locale.country.ifEmpty { v.locale.variant }
      val i = countries.indexOf(c.uppercase(Locale.ROOT))
      return if (i < 0) countries.size else i
    }
    return voicesFor(engine, lang).sortedWith(
      compareBy<Voice>({ if (isMale(it)) 0 else 1 }, { countryRank(it) }, { if (it.isNetworkConnectionRequired) 1 else 0 }, { -it.quality }),
    ).firstOrNull()
  }

  /**
   * Sets the voice for a line: the one the user picked when still installed, else the best male one, else the
   * language's default spoken lower. Returns the voice used, or null when the language has no voice at all.
   */
  fun apply(engine: TextToSpeech, lang: String, wanted: String?): Pair<Voice?, Boolean>? {
    awaitVoices(engine, lang)
    val chosen = wanted?.let { name -> voicesFor(engine, lang).firstOrNull { it.name == name } }
    val voice = chosen ?: pick(engine, lang)
    if (voice != null) {
      engine.voice = voice
    } else if (engine.setLanguage(Locale(lang)) < TextToSpeech.LANG_AVAILABLE) {
      return null
    }
    engine.setPitch(if (chosen != null || (voice != null && isMale(voice))) 1.0f else 0.8f)
    engine.setSpeechRate(1.05f)
    return voice to (voice?.let(::isMale) ?: false)
  }
}
