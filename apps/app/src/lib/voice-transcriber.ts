type ProgressInfo = { status: string; file?: string; progress?: number };

type ProgressListener = (info: ProgressInfo) => void;

type SpeechToText = InstanceType<typeof import('runonweb/stt')['SpeechToText']>;

// One warm recogniser for the whole session: loading Whisper takes seconds, so it is
// created on first use and reused for every later phrase instead of being disposed.
let warm: { stt: SpeechToText; listener: { current?: ProgressListener } } | undefined;

async function getRecognizer(onProgress?: ProgressListener) {
  if (!warm) {
    const { SpeechToText } = await import('runonweb/stt');
    const listener: { current?: ProgressListener } = {};
    const stt = new SpeechToText({
      model: 'onnx-community/whisper-base',
      language: 'es',
      device: 'auto',
      onProgress: (info: ProgressInfo) => listener.current?.(info),
    });
    warm = { stt, listener };
  }
  warm.listener.current = onProgress;
  return warm;
}

/** Loads RunOnWeb only after the user requests dictation; audio inference stays on device. */
export async function transcribeWorkoutAudio(blob: Blob, onProgress?: ProgressListener, signal?: AbortSignal): Promise<string> {
  const recognizer = await getRecognizer(onProgress);
  if (signal?.aborted) throw new DOMException('Prueba cancelada.', 'AbortError');
  try {
    const result = await recognizer.stt.transcribe(blob, { task: 'transcribe', language: 'es' });
    if (signal?.aborted) throw new DOMException('Prueba cancelada.', 'AbortError');
    return result.text.trim();
  } catch (error) {
    // A failed load can leave the instance unusable; drop it so the next phrase retries.
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      warm?.stt.dispose();
      warm = undefined;
    }
    throw error;
  } finally {
    if (warm) warm.listener.current = undefined;
  }
}
