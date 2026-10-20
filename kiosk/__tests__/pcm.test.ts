import { describe, expect, it } from 'vitest';
import { floatToPcm16Base64, pcm16Base64ToFloat } from '../lib/pcm';

describe('UC-04 PCM16', () => {
  it('AC15: แปลง PCM16 ไปกลับ', () => {
    const base64 = floatToPcm16Base64(new Float32Array([0, 0.5, -1]));
    // 3 sample × 2 ไบต์ little-endian
    expect(atob(base64)).toHaveLength(6);
    const back = pcm16Base64ToFloat(base64);
    expect(back).toHaveLength(3);
    [0, 0.5, -1].forEach((v, i) => expect(Math.abs((back[i] as number) - v)).toBeLessThanOrEqual(1 / 32768));
  });

  it('AC15: ค่าที่เกินช่วง -1..1 ถูกตัดไม่ล้น', () => {
    const back = pcm16Base64ToFloat(floatToPcm16Base64(new Float32Array([2, -2])));
    expect(back[0]).toBeCloseTo(1, 3);
    expect(back[1]).toBe(-1);
  });
});
