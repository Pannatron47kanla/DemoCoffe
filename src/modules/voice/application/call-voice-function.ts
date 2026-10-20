import { DomainError } from '../../../shared/domain-error';
import type { VoiceSessionRepository } from '../domain/repositories';
import type { VoiceFunctionCall } from '../domain/voice-function-call';
import type { CartAvailability, CartSnapshot, VoiceCartOperations } from './ports';

// UC-03 AC3: ส่งต่อ function call ของ Gemini ไปทำกับตะกร้าของเซสชัน (R2) การ map ชื่อ → operation เป็นการส่งต่อ ไม่ใช่กฎธุรกิจ
export class CallVoiceFunction {
  constructor(private readonly deps: { sessions: VoiceSessionRepository; cartOperations: VoiceCartOperations; carts: CartAvailability }) {}

  async execute(input: { sessionId: string; call: VoiceFunctionCall }): Promise<{ action: 'SHOW_CART' | 'SHOW_CHECKOUT'; cart: CartSnapshot }> {
    const { sessions, cartOperations, carts } = this.deps;
    const session = await sessions.findById(input.sessionId);
    if (!session) throw new DomainError('VOICE_SESSION_NOT_FOUND');
    await carts.assertOpen(session.cartId); // AC15: หมดอายุหรือยืนยันแล้ว หยุดก่อนแตะตะกร้า ทุกฟังก์ชัน

    const { call } = input;
    switch (call.name) {
      case 'add_to_cart': {
        const cart = await cartOperations.add(session.cartId, {
          menuItemId: call.menuItemId, optionChoiceIds: call.optionChoiceIds, quantity: call.quantity,
        });
        return { action: 'SHOW_CART', cart };
      }
      case 'change_quantity': {
        const cart = await cartOperations.changeQuantity(session.cartId, call.lineId, call.quantity);
        return { action: 'SHOW_CART', cart };
      }
      case 'remove_from_cart': {
        const cart = await cartOperations.remove(session.cartId, call.lineId);
        return { action: 'SHOW_CART', cart };
      }
      case 'view_cart': {
        const cart = await cartOperations.view(session.cartId);
        return { action: 'SHOW_CART', cart };
      }
      case 'request_checkout': {
        // R3: แค่ขอหน้ายืนยัน ไม่ยืนยันออเดอร์
        const cart = await cartOperations.readyForCheckout(session.cartId);
        return { action: 'SHOW_CHECKOUT', cart };
      }
    }
  }
}
