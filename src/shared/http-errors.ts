import type { ErrorRequestHandler } from 'express';
import { DomainError } from './domain-error';

// ข้อมูลผิดรูปแบบจากชั้น interface (AC6) ไม่ใช่กฎธุรกิจ
export class RequestValidationError extends Error {
  constructor(readonly fields: string[]) {
    super(`invalid fields: ${fields.join(', ')}`);
    this.name = 'RequestValidationError';
  }
}

// code → HTTP status และข้อความให้ลูกค้า ต้องตรงกับ Error.code ใน openapi.yaml
const ERRORS: Record<string, { status: number; message: string }> = {
  VALIDATION_ERROR: { status: 400, message: 'ข้อมูลไม่ถูกต้อง' },
  MENU_ITEM_NOT_FOUND: { status: 404, message: 'ไม่พบเมนูนี้' },
  VOICE_SESSION_NOT_FOUND: { status: 404, message: 'ไม่พบเซสชันเสียง' },
  CART_NOT_FOUND: { status: 404, message: 'ไม่พบตะกร้า' },
  CART_LINE_NOT_FOUND: { status: 404, message: 'ไม่พบรายการในตะกร้า' },
  MENU_ITEM_UNAVAILABLE: { status: 409, message: 'เมนูนี้หมดแล้ว' },
  OPTION_REQUIRED: { status: 409, message: 'กรุณาเลือกตัวเลือกที่จำเป็น' },
  INVALID_OPTION: { status: 409, message: 'ตัวเลือกไม่ตรงกับเมนูนี้' },
  QUANTITY_OUT_OF_RANGE: { status: 409, message: 'จำนวนต่อรายการต้องอยู่ระหว่าง 1–10 แก้ว' },
  CART_LIMIT_REACHED: { status: 409, message: 'ตะกร้ามีได้ไม่เกิน 20 แก้ว' },
  CART_EXPIRED: { status: 409, message: 'ตะกร้าหมดอายุ กรุณาเริ่มสั่งใหม่' },
  CART_ALREADY_CHECKED_OUT: { status: 409, message: 'ตะกร้านี้ยืนยันแล้ว' },
  CART_EMPTY: { status: 409, message: 'ตะกร้ายังว่าง' },
  PRICE_CHANGED: { status: 409, message: 'ราคามีการเปลี่ยนแปลง กรุณาตรวจยอดใหม่' },
  IDEMPOTENCY_KEY_CONFLICT: { status: 409, message: 'key นี้ใช้กับตะกร้าอื่นแล้ว' },
  CONSENT_TEXT_OUTDATED: { status: 409, message: 'ข้อความยินยอมมีการเปลี่ยนแปลง กรุณาอ่านอีกครั้ง' },
  VOICE_UNAVAILABLE: { status: 503, message: 'ตอนนี้สั่งด้วยเสียงไม่ได้ กรุณาสั่งด้วยการแตะ' },
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof RequestValidationError) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: ERRORS.VALIDATION_ERROR!.message, details: { fields: error.fields } });
    return;
  }
  // express.json() อ่าน body ไม่ได้
  if ((error as { type?: string }).type === 'entity.parse.failed') {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'JSON ไม่ถูกต้อง', details: { fields: ['body'] } });
    return;
  }
  const known = error instanceof DomainError ? ERRORS[error.code] : undefined;
  if (error instanceof DomainError && known) {
    const body: Record<string, unknown> = { code: error.code, message: known.message };
    if (Object.keys(error.details).length > 0) body.details = error.details;
    res.status(known.status).json(body);
    return;
  }
  console.error(error);
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'ระบบขัดข้อง กรุณาติดต่อพนักงาน' });
};
