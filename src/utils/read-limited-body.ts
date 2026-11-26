export async function readLimitedBody(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declaredSize = response.headers.get('Content-Length');
  if (!response.body || (declaredSize !== null && Number(declaredSize) > maxBytes)) {
    void response.body?.cancel().catch(() => {});
    throw new Error('Invalid response body size');
  }

  const reader = response.body.getReader();
  const bytes = new Uint8Array(maxBytes);
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return bytes.subarray(0, size);
      if (size + value.byteLength > maxBytes) throw new Error('Response body exceeds size limit');
      bytes.set(value, size);
      size += value.byteLength;
    }
  } catch (error) {
    void reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}
