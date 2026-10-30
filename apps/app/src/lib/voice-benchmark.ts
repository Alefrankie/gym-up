import { Gzip, Unzip, UnzipInflate, UnzipPassThrough } from 'fflate';
import voskWorkerUrl from './vosk-benchmark.worker.js?url';
import voskWasmUrl from '@lichess-org/vosk-browser/dist/vosk.wasm?url';

const MODEL_ZIP_URL = 'https://huggingface.co/rhasspy/vosk-models/resolve/main/es/vosk-model-small-es-0.42.zip';
const MODEL_CACHE_DB = 'gymup-voice-benchmark';
const MODEL_CACHE_VERSION = 1;
const VOSK_TAR_KEY = 'vosk-small-es-0.42.tar.gz';
const TAR_BLOCK_SIZE = 512;

export type BenchmarkProgress = {
  status: 'downloading' | 'converting' | 'loading' | 'transcribing';
  progress?: number;
};

export type VoskTranscription = {
  text: string;
  elapsedMs: number;
  modelLoadMs: number;
  inferenceMs: number;
  downloadedBytes: number;
  archiveBytes: number;
  archiveCached: boolean;
};

type ModelCacheRecord = { key: string; blob: Blob; bytes: number };

function openModelCache(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(MODEL_CACHE_DB, MODEL_CACHE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('assets')) {
        request.result.createObjectStore('assets', { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir la caché local.'));
  });
}

async function readModelCache(key: string): Promise<ModelCacheRecord | undefined> {
  const db = await openModelCache();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('assets', 'readonly').objectStore('assets').get(key);
      request.onsuccess = () => resolve(request.result as ModelCacheRecord | undefined);
      request.onerror = () => reject(request.error ?? new Error('No se pudo leer la caché local.'));
    });
  } finally {
    db.close();
  }
}

async function writeModelCache(record: ModelCacheRecord): Promise<void> {
  const db = await openModelCache();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('assets', 'readwrite');
      transaction.objectStore('assets').put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('No se pudo guardar el modelo en el dispositivo.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('No se pudo guardar el modelo en el dispositivo.'));
    });
  } finally {
    db.close();
  }
}

async function removeModelCache(key: string): Promise<void> {
  const db = await openModelCache();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('assets', 'readwrite');
      transaction.objectStore('assets').delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('No se pudo liberar espacio del modelo.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('No se pudo liberar espacio del modelo.'));
    });
  } finally { db.close(); }
}

function writeOctal(header: Uint8Array, offset: number, length: number, value: number) {
  const text = Math.floor(value).toString(8).padStart(length - 1, '0');
  header.set(new TextEncoder().encode(text.slice(-length + 1)), offset);
  header[offset + length - 1] = 0;
}

function makeTarHeader(path: string, size: number): Uint8Array {
  const header = new Uint8Array(TAR_BLOCK_SIZE);
  header.set(new TextEncoder().encode(path), 0);
  writeOctal(header, 100, 8, 0o644);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, size);
  writeOctal(header, 136, 12, 0);
  header.fill(0x20, 148, 156);
  header[156] = '0'.charCodeAt(0);
  header.set(new TextEncoder().encode('ustar\0'), 257);
  header.set(new TextEncoder().encode('00'), 263);
  let checksum = 0;
  for (const byte of header) checksum += byte;
  header.set(new TextEncoder().encode(`${checksum.toString(8).padStart(6, '0')}\0 `), 148);
  return header;
}

async function convertZipToTarGz(response: Response, signal?: AbortSignal): Promise<{ blob: Blob; downloadedBytes: number }> {
  if (!response.body) throw new Error('El navegador no permite descargar el modelo por bloques.');
  const compressedChunks: Uint8Array[] = [];
  const gzip = new Gzip({ level: 6 }, (chunk) => compressedChunks.push(chunk));
  let foundModel = false;
  let fileCount = 0;
  let failed: unknown;
  const unzip = new Unzip((file) => {
    if (failed || file.name.endsWith('/')) return;
    const normalized = file.name.replaceAll('\\', '/').replace(/^\.\//, '');
    const [root, ...rest] = normalized.split('/');
    const path = root && rest.length ? `${root}/${rest.join('/')}` : '';
    const size = file.originalSize;
    if (!path || new TextEncoder().encode(path).length > 100 || size === undefined || !Number.isFinite(size)) {
      failed = new Error(`Ruta inesperada en el modelo Vosk: ${file.name}`);
      return;
    }
    if (path.endsWith('/am/final.mdl')) foundModel = true;
    gzip.push(makeTarHeader(path, size), false);
    file.ondata = (error, chunk, final) => {
      if (error) { failed = error; return; }
      gzip.push(chunk, false);
      if (final) {
        const remainder = size % TAR_BLOCK_SIZE;
        if (remainder) gzip.push(new Uint8Array(TAR_BLOCK_SIZE - remainder), false);
        fileCount += 1;
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  unzip.register(UnzipPassThrough);
  const reader = response.body.getReader();
  let downloadedBytes = 0;
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException('Prueba cancelada.', 'AbortError');
      const { done, value } = await reader.read();
      if (done) break;
      downloadedBytes += value.byteLength;
      unzip.push(value);
      if (failed) throw failed;
    }
    unzip.push(new Uint8Array(0), true);
    if (failed) throw failed;
    if (!foundModel || fileCount === 0) throw new Error('El archivo descargado no contiene un modelo Vosk español reconocible.');
    gzip.push(new Uint8Array(TAR_BLOCK_SIZE * 2), true);
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }
  return { blob: new Blob(compressedChunks as BlobPart[], { type: 'application/gzip' }), downloadedBytes };
}

async function getVoskArchive(onProgress?: (progress: BenchmarkProgress) => void, signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Prueba cancelada.', 'AbortError');
  const cachedTar = await readModelCache(VOSK_TAR_KEY);
  if (cachedTar) {
    await removeModelCache('vosk-small-es-0.42.zip');
    return { blob: cachedTar.blob, downloadedBytes: 0, archiveBytes: cachedTar.bytes, archiveCached: true };
  }

  let downloadedBytes = 0;
  onProgress?.({ status: 'downloading', progress: 0 });
  const response = await fetch(MODEL_ZIP_URL, { cache: 'no-cache', signal });
  if (!response.ok) throw new Error(`No se pudo descargar el modelo Vosk (HTTP ${response.status}).`);
  onProgress?.({ status: 'converting' });
  const converted = await convertZipToTarGz(response, signal);
  downloadedBytes = converted.downloadedBytes;
  const archive = converted.blob;
  const archiveRecord = { key: VOSK_TAR_KEY, blob: archive, bytes: archive.size };
  try {
    await writeModelCache(archiveRecord);
    await removeModelCache('vosk-small-es-0.42.zip');
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      await removeModelCache(VOSK_TAR_KEY);
      throw new Error('No hay espacio suficiente para guardar el modelo Vosk. Libera espacio y vuelve a intentarlo.');
    }
    throw error;
  }
  return { blob: archive, downloadedBytes, archiveBytes: archive.size, archiveCached: false };
}

function decodeAudio(blob: Blob): Promise<{ context: AudioContext; buffer: AudioBuffer }> {
  return new Promise((resolve, reject) => {
    const context = new AudioContext();
    void blob.arrayBuffer().then((data) => context.decodeAudioData(data))
      .then((buffer) => resolve({ context, buffer }))
      .catch((error) => {
        void context.close();
        reject(error);
      });
  });
}

export async function transcribeWithVosk(
  audio: Blob,
  onProgress?: (progress: BenchmarkProgress) => void,
  signal?: AbortSignal,
): Promise<VoskTranscription> {
  const startedAt = performance.now();
  const decoded = await decodeAudio(audio);
  let recognizer: InstanceType<VoskClient['KaldiRecognizer']> | undefined;
  try {
    const loadStartedAt = performance.now();
    const { client, modelArchive, fresh } = await getWarmVosk(onProgress, signal);
    if (signal?.aborted) throw new DOMException('Prueba cancelada.', 'AbortError');
    const modelLoadMs = performance.now() - loadStartedAt;
    recognizer = new client.KaldiRecognizer(decoded.buffer.sampleRate);
    onProgress?.({ status: 'transcribing' });

    const inferenceStartedAt = performance.now();
    const text = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Vosk tardó demasiado en transcribir el audio.')), 30_000);
      // The worker answers acceptWaveform with exactly one event (result or
      // partialresult) and retrieveFinalResult with one result, in order.
      let firstText = '';
      let events = 0;
      const onAbort = () => {
        clearTimeout(timeout);
        reject(new DOMException('Prueba cancelada.', 'AbortError'));
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      const onEvent = (piece: string) => {
        events += 1;
        if (events === 1) { firstText = piece; return; }
        clearTimeout(timeout);
        signal?.removeEventListener('abort', onAbort);
        resolve([firstText, piece].filter(Boolean).join(' ').trim());
      };
      recognizer!.on('partialresult', (event) => {
        if (event.event === 'partialresult') onEvent('');
      });
      recognizer!.on('result', (event) => {
        if (event.event === 'result') onEvent(event.result.text.trim());
      });
      recognizer!.on('error', (event) => {
        if (event.event !== 'error') return;
        clearTimeout(timeout);
        signal?.removeEventListener('abort', onAbort);
        reject(new Error(event.error));
      });
      recognizer!.acceptWaveform(decoded.buffer);
      recognizer!.retrieveFinalResult();
    });
    const inferenceMs = performance.now() - inferenceStartedAt;
    return {
      text,
      elapsedMs: performance.now() - startedAt,
      modelLoadMs,
      inferenceMs,
      downloadedBytes: fresh ? modelArchive.downloadedBytes : 0,
      archiveBytes: modelArchive.archiveBytes,
      archiveCached: modelArchive.archiveCached || !fresh,
    };
  } finally {
    recognizer?.remove();
    await decoded.context.close();
  }
}

type VoskClient = Awaited<ReturnType<typeof import('@lichess-org/vosk-browser')['createVoskClient']>>;
type WarmVosk = { client: VoskClient; modelArchive: Awaited<ReturnType<typeof getVoskArchive>> };

// The model stays loaded in its worker for the session; only the per-phrase recogniser is recreated.
let warmVosk: Promise<WarmVosk> | undefined;

async function getWarmVosk(onProgress?: (progress: BenchmarkProgress) => void, signal?: AbortSignal) {
  if (warmVosk) return { ...(await warmVosk), fresh: false };
  const loading = (async () => {
    // No abort signal here: a load that finishes after the user leaves is still useful next time.
    const modelArchive = await getVoskArchive(onProgress);
    const { createVoskClient } = await import('@lichess-org/vosk-browser');
    onProgress?.({ status: 'loading' });
    // Kept for the session: the worker reads the model from this URL.
    const archiveUrl = URL.createObjectURL(modelArchive.blob);
    const client = await createVoskClient({ modelUrl: archiveUrl, workerUrl: voskWorkerUrl, wasmUrl: voskWasmUrl, logLevel: -1 });
    return { client, modelArchive };
  })();
  warmVosk = loading;
  loading.catch(() => { if (warmVosk === loading) warmVosk = undefined; });
  const loaded = signal
    ? await Promise.race([loading, new Promise<never>((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Prueba cancelada.', 'AbortError')), { once: true }))])
    : await loading;
  return { ...loaded, fresh: true };
}

export const VOSK_MODEL_DOWNLOAD_URL = MODEL_ZIP_URL;
