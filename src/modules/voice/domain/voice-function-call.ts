// ฟังก์ชันที่ Gemini เรียกได้ (R4) รูปที่ผ่านการตรวจแล้ว
export type VoiceFunctionCall =
  | { name: 'add_to_cart'; menuItemId: string; optionChoiceIds: string[]; quantity: number }
  | { name: 'change_quantity'; lineId: string; quantity: number }
  | { name: 'remove_from_cart'; lineId: string }
  | { name: 'view_cart' }
  | { name: 'request_checkout' };

export const VOICE_FUNCTION_NAMES = ['add_to_cart', 'change_quantity', 'remove_from_cart', 'view_cart', 'request_checkout'] as const;
