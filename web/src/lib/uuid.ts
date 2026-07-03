// UUIDv7 (time-ordered) — blueprint §10 conventions: every client-created row
// and every sync op carries a client-generated UUIDv7 so offline creation is
// conflict-free and inserts stay index-local.

export function uuidv7(): string {
  // Unix-ms fits in 48 bits, well inside Number's 53-bit integer precision,
  // so plain division/modulo is exact (no BigInt; keeps tsconfig target free).
  let ts = Date.now();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // 48-bit big-endian unix-ms timestamp
  for (let i = 5; i >= 0; i--) {
    bytes[i] = ts % 256;
    ts = Math.floor(ts / 256);
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
