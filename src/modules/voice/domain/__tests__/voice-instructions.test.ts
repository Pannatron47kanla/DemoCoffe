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

  it('AC2: คำสั่งระบบมีข้อปฏิบัติตาม R5', () => {
    const text = buildVoiceInstructions(menu);

    const rules: Record<string, string> = {
      'พูดภาษาไทยสั้นๆ': 'พูดภาษาไทยสั้นๆ',
      'ถามตัวเลือกที่ต้องเลือกก่อนเรียก add_to_cart': 'ถามลูกค้าก่อนเรียก add_to_cart',
      'ไม่เดาเมนูที่ไม่มี': 'ห้ามเดาเมนู',
      'พูดราคาตามผลของฟังก์ชันเท่านั้น': 'ผลลัพธ์ของฟังก์ชันเท่านั้น',
      'เรียก request_checkout แล้วบอกให้แตะยืนยันบนจอ': 'แตะยืนยันบนจอ',
      'ห้ามยืนยันออเดอร์เอง': 'ห้ามยืนยันออเดอร์เอง',
    };
    for (const [rule, keyword] of Object.entries(rules)) expect(text, rule).toContain(keyword);
    expect(text).toContain('request_checkout');
    for (const word of ['cartId', 'kioskId', 'kiosk', 'phone', 'เบอร์', 'image']) expect(text).not.toContain(word);
  });

  it('AC1: เมนูเดียวกันได้ข้อความเดียวกัน', () => {
    expect(buildVoiceInstructions(menu)).toBe(buildVoiceInstructions(menu));
  });
});
