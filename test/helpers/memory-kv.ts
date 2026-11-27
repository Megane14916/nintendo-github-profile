import { vi } from 'vitest';
import { PRESENCE_KEY } from '../../src/storage/presence';

export function memoryKv(value: string | null = null) {
  const entries = new Map<string, { value: string; metadata: unknown }>();
  if (value !== null) entries.set(PRESENCE_KEY, { value, metadata: null });
  return {
    get: vi.fn().mockImplementation(async (key: string) => entries.get(key)?.value ?? null),
    put: vi.fn().mockImplementation(async (key: string, next: string, options?: KVNamespacePutOptions) => {
      entries.set(key, { value: next, metadata: options?.metadata ?? null });
    }),
    getWithMetadata: vi.fn().mockImplementation(async (key: string) => {
      const entry = entries.get(key);
      return {
        value: entry ? new ReadableStream({ start: (controller) => controller.close() }) : null,
        metadata: entry?.metadata ?? null,
      };
    }),
    list: vi.fn(),
    delete: vi.fn(),
  };
}
