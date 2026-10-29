// src/lib/contexts/private-photos/domain/photo-storage.ts
//
// Port for the object store that holds the photo bytes (ADR-005, ADR-027): Cloudflare R2 in production,
// an in-memory map in tests. Objects are private: they are only ever read through the owner-checked API.

export interface StoredObject {
  bytes: Uint8Array;
  contentType: string;
}

export abstract class PhotoStorage {
  abstract put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  abstract get(key: string): Promise<StoredObject | null>;
  abstract delete(key: string): Promise<void>;
}
