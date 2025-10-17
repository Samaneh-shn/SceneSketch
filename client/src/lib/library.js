// client/src/lib/library.js
import { tx } from './db';

// Stable content hash (SHA-256) for dedup + key
export async function hashBuffer(buf) {
  const h = await crypto.subtle.digest('SHA-256', buf);
  const b = Array.from(new Uint8Array(h)).map(x => x.toString(16).padStart(2,'0')).join('');
  return b;
}

export async function importBook(file) {
  const arrayBuffer = await file.arrayBuffer();
  const id = await hashBuffer(arrayBuffer);

  // upsert book blob + metadata
  await tx('books', 'readwrite', (s) => s.put({
    id,
    name: file.name,
    size: file.size,
    type: file.type || 'application/epub+zip',
    addedAt: Date.now(),
    blob: new Blob([arrayBuffer], { type: 'application/epub+zip' }),
  }));

  return { id, name: file.name, arrayBuffer };
}

export async function listBooks() {
  return tx('books', 'readonly', async (s) => {
    return new Promise((resolve, reject) => {
      const items = [];
      const req = s.index('by_addedAt').openCursor(null, 'prev');
      req.onsuccess = (e) => {
        const cur = e.target.result;
        if (!cur) return resolve(items);
        const v = cur.value;
        items.push({ id: v.id, name: v.name, size: v.size, addedAt: v.addedAt });
        cur.continue();
      };
      req.onerror = () => reject(req.error);
    });
  });
}

export async function getBookBuffer(id) {
  const rec = await tx('books', 'readonly', (s) => s.get(id));
  if (!rec) return null;
  // blob -> ArrayBuffer
  return await rec.blob.arrayBuffer();
}

export async function deleteBook(id) {
  await tx('books', 'readwrite', (s) => s.delete(id));
  await tx('positions', 'readwrite', (s) => s.delete(id));
}

export async function savePosition(id, cfi) {
  if (!id || !cfi) return;
  await tx('positions', 'readwrite', (s) => s.put({ id, cfi, updatedAt: Date.now() }));
}

export async function getPosition(id) {
  if (!id) return null;
  const rec = await tx('positions', 'readonly', (s) => s.get(id));
  return rec?.cfi || null;
}
