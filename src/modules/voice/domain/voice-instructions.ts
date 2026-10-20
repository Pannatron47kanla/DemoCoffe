import type { VoiceMenuChoice, VoiceMenuGroup, VoiceMenuItem } from './voice-menu';

// ราคาเป็นบาท: หาร 100 ลงตัวแสดงจำนวนเต็ม ไม่งั้นทศนิยม 2 ตำแหน่ง
function baht(satang: number): string {
  return satang % 100 === 0 ? `${satang / 100} บาท` : `${(satang / 100).toFixed(2)} บาท`;
}

function choiceText(choice: VoiceMenuChoice): string {
  const price = choice.priceDeltaSatang === 0 ? '' : ` +${baht(choice.priceDeltaSatang)}`;
  return `${choice.id} ${choice.name}${price}`;
}

function groupText(group: VoiceMenuGroup): string {
  const rule = group.required ? 'ต้องเลือก' : 'ไม่บังคับ';
  return `  - ${group.name} (กลุ่ม ${group.id}, ${rule}): ${group.choices.map(choiceText).join(', ')}`;
}

function itemText(item: VoiceMenuItem): string {
  const sold = item.available ? '' : ' [หมด]';
  const head = `- ${item.id} (${item.name}) ${baht(item.basePriceSatang)}${sold}`;
  return [head, ...item.optionGroups.map(groupText)].join('\n');
}

// ข้อปฏิบัติของผู้ช่วย (R5) ข้อความคงที่ ไม่มีข้อมูลบุคคล ไม่มี cartId หรือรหัสตู้ (AC2)
const BEHAVIOUR_RULES = [
  'คุณเป็นผู้ช่วยรับออเดอร์เครื่องดื่มที่ตู้สั่งเอง',
  'ข้อปฏิบัติ:',
  '1. พูดภาษาไทยสั้นๆ ประโยคเดียวต่อครั้ง',
  '2. ถ้าเมนูมีกลุ่มตัวเลือกที่ต้องเลือก ให้ถามลูกค้าก่อนเรียก add_to_cart ให้ครบทุกกลุ่ม',
  '3. ห้ามเดาเมนูที่ไม่มีในรายการ ถ้าลูกค้าขอเมนูที่ไม่มีหรือเมนูที่หมด ให้บอกตรงๆ และเสนอเมนูที่มี',
  '4. พูดราคาจากผลลัพธ์ของฟังก์ชันเท่านั้น ห้ามคำนวณหรือเดาราคาเอง',
  '5. เมื่อลูกค้าจะจ่ายเงิน ให้เรียก request_checkout แล้วบอกให้ลูกค้าแตะยืนยันบนจอ',
  '6. ห้ามยืนยันออเดอร์เอง การยืนยันทำโดยลูกค้าแตะบนจอเท่านั้น',
  '7. ก่อน change_quantity หรือ remove_from_cart ให้ใช้ id รายการ (lines[].id) จากผลของฟังก์ชันล่าสุด ถ้าไม่แน่ใจหรือยังไม่เคยเห็นตะกร้า ให้เรียก view_cart ก่อน',
  '8. id ภาษาอังกฤษในเมนู (เช่น latte, size-l, กลุ่ม size) ส่งในฟังก์ชันเท่านั้น ไม่ต้องพูด id ให้ลูกค้าฟัง',
];

// คำสั่งระบบของ Gemini: ข้อปฏิบัติ (R5) + เมนูปัจจุบัน (R4) ผลลัพธ์เดียวกันสำหรับเมนูเดียวกัน
export function buildVoiceInstructions(menu: readonly VoiceMenuItem[]): string {
  return [...BEHAVIOUR_RULES, '', 'เมนูของร้าน:', ...menu.map(itemText)].join('\n');
}
