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
  return `  - ${group.name} (${group.id}, ${rule}): ${group.choices.map(choiceText).join(', ')}`;
}

function itemText(item: VoiceMenuItem): string {
  const sold = item.available ? '' : ' [หมด]';
  const head = `- ${item.id} (${item.name}) ${baht(item.basePriceSatang)}${sold}`;
  return [head, ...item.optionGroups.map(groupText)].join('\n');
}

// คำสั่งระบบของ Gemini: เมนูปัจจุบัน (R4) ผลลัพธ์เดียวกันสำหรับเมนูเดียวกัน
export function buildVoiceInstructions(menu: readonly VoiceMenuItem[]): string {
  return ['เมนูของร้าน:', ...menu.map(itemText)].join('\n');
}
