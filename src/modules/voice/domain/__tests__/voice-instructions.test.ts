import { describe, expect, it } from 'vitest';
import { buildVoiceInstructions } from '../voice-instructions';
import { latte, menu } from './voice-menu-fixtures';

const lineOf = (text: string, needle: string) => text.split('\n').find((l) => l.includes(needle)) ?? '';

describe('buildVoiceInstructions', () => {
  it('AC1: คำสั่งระบบมีทุกเมนู id ชื่อ ราคาบาท กลุ่มตัวเลือก ต้องเลือกหรือไม่ และตัวเลือกพร้อมราคาเพิ่ม', () => {
    const text = buildVoiceInstructions(menu);

    for (const word of ['latte', 'ลาเต้', '55 บาท', 'size-l', '+10 บาท', 'milk-oat', '+15 บาท']) expect(text).toContain(word);
    expect(text).toMatch(/ขนาด[^\n]*ต้องเลือก/);
    expect(text).toMatch(/นม[^\n]*ไม่บังคับ/);
  });

  it('AC1: เมนูที่หมดระบุว่าหมด', () => {
    const text = buildVoiceInstructions(menu);

    expect(lineOf(text, 'matcha-latte')).toContain('หมด');
    expect(lineOf(text, 'latte (')).not.toContain('หมด');
  });

  it('AC1: ราคาไม่ลงตัวร้อยแสดงทศนิยม 2 ตำแหน่ง และส่วนต่าง 0 ไม่แสดงราคา', () => {
    const text = buildVoiceInstructions([{ ...latte, basePriceSatang: 5550 }]);

    expect(text).toContain('55.50 บาท');
    expect(text).toMatch(/size-m M(,|$)/m); // ส่วนต่าง 0 ไม่มี +ราคาต่อท้าย
  });

  it('AC1: เมนูเดียวกันได้ข้อความเดียวกัน', () => {
    expect(buildVoiceInstructions(menu)).toBe(buildVoiceInstructions(menu));
  });
});
