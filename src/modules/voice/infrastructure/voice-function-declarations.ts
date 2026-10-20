import { Type, type FunctionDeclaration } from '@google/genai';

// ชื่อตรงกับ VOICE_FUNCTION_NAMES; ไม่มีพารามิเตอร์ cartId เพราะเซิร์ฟเวอร์ผูกกับเซสชันเอง
export const VOICE_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'add_to_cart',
    description: 'เพิ่มเมนูลงตะกร้า ระบุ id เมนู id ตัวเลือก และจำนวน',
    parameters: {
      type: Type.OBJECT,
      properties: {
        menuItemId: { type: Type.STRING, description: 'id ของเมนูตามรายการเมนู' },
        optionChoiceIds: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'id ของตัวเลือกที่ลูกค้าเลือก' },
        quantity: { type: Type.INTEGER, description: 'จำนวนแก้ว' },
      },
      required: ['menuItemId', 'quantity'],
    },
  },
  {
    name: 'change_quantity',
    description: 'เปลี่ยนจำนวนของรายการที่อยู่ในตะกร้าแล้ว',
    parameters: {
      type: Type.OBJECT,
      properties: {
        lineId: { type: Type.STRING, description: 'id ของรายการในตะกร้า' },
        quantity: { type: Type.INTEGER, description: 'จำนวนใหม่' },
      },
      required: ['lineId', 'quantity'],
    },
  },
  {
    name: 'remove_from_cart',
    description: 'ลบรายการออกจากตะกร้า',
    parameters: {
      type: Type.OBJECT,
      properties: { lineId: { type: Type.STRING, description: 'id ของรายการในตะกร้า' } },
      required: ['lineId'],
    },
  },
  { name: 'view_cart', description: 'ดูรายการและราคารวมในตะกร้าปัจจุบัน' },
  { name: 'request_checkout', description: 'ลูกค้าต้องการจ่ายเงิน ให้แสดงหน้าตรวจสอบเพื่อให้ลูกค้ายืนยันบนจอ' },
];
