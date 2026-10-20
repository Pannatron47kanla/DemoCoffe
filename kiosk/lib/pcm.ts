// PCM16 little-endian ↔ Float32 (-1..1) สำหรับเสียงที่รับส่งกับ Gemini Live เป็น base64

export function floatToPcm16Base64(samples: Float32Array): string {
  const view = new DataView(new ArrayBuffer(samples.length * 2));
  samples.forEach((s, i) => {
    const clamped = Math.max(-1, Math.min(1, s));
    view.setInt16(i * 2, Math.round(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff), true);
  });
  let binary = '';
  const bytes = new Uint8Array(view.buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] as number);
  return btoa(binary);
}

export function pcm16Base64ToFloat(base64: string): Float32Array<ArrayBuffer> {
  const binary = atob(base64);
  const view = new DataView(new ArrayBuffer(binary.length - (binary.length % 2)));
  for (let i = 0; i < view.byteLength; i++) view.setUint8(i, binary.charCodeAt(i));
  const out = new Float32Array(view.byteLength / 2);
  for (let i = 0; i < out.length; i++) out[i] = view.getInt16(i * 2, true) / 0x8000;
  return out;
}
