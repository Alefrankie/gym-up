type ProgressInfo = { status: string; file?: string; progress?: number };

type ProgressListener = (info: ProgressInfo) => void;

/** Loads RunOnWeb only after the user requests dictation; audio inference stays on device. */
export async function transcribeWorkoutAudio(blob: Blob, onProgress?: ProgressListener, signal?: AbortSignal): Promise<string> {
  const { SpeechToText } = await import('runonweb/stt');
  if (signal?.aborted) throw new DOMException('Prueba cancelada.', 'AbortError');
  const stt = new SpeechToText({
    model: 'onnx-community/whisper-tiny',
    language: 'es',
    device: 'auto',
    onProgress,
  });
  try {
    const result = await stt.transcribe(blob, { task: 'transcribe', language: 'es' });
    if (signal?.aborted) throw new DOMException('Prueba cancelada.', 'AbortError');
    return result.text.trim();
  } finally {
    stt.dispose();
  }
}
