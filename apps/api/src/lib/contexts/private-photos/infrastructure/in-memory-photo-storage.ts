import { PhotoStorage, type StoredObject } from '../domain/photo-storage';

/** Real implementation used by tests and local runs without an R2 bucket (not a mock: it stores and returns the bytes). */
export class InMemoryPhotoStorage implements PhotoStorage {
  private readonly objects = new Map<string, StoredObject>();

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    this.objects.set(key, { bytes: new Uint8Array(bytes), contentType });
  }

  async get(key: string): Promise<StoredObject | null> {
    const o = this.objects.get(key);
    return o ? { bytes: new Uint8Array(o.bytes), contentType: o.contentType } : null;
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }

  get size(): number {
    return this.objects.size;
  }
}
