import type { KioskApi } from './api';
import type { Cart, VoiceFunctionResult } from './types';
import type { FunctionCall } from './voice-link';

export type RelayResult = {
  responses: { id: string; name: string; response: unknown }[];
  cart?: Cart;
  showCheckout: boolean;
  fatal: boolean;
};

// status ที่ส่ง body กลับให้ Gemini ตัดสินต่อ (UC-03 R7); อื่นๆ (503/500/ไม่รู้จัก) ถือว่าเสียงใช้ต่อไม่ได้
const RELAYED = new Set([200, 400, 404, 409]);

/** ส่ง function call ให้ api ทีละตัวตามลำดับ ตัดสิน relay/fatal ที่นี่ที่เดียว */
export async function relayFunctionCalls(api: KioskApi, sessionId: string, calls: FunctionCall[]): Promise<RelayResult> {
  const result: RelayResult = { responses: [], showCheckout: false, fatal: false };
  for (const call of calls) {
    let reply: { status: number; body: unknown };
    try {
      reply = await api.callVoiceFunction(sessionId, { name: call.name, args: call.args });
    } catch {
      return { ...result, fatal: true };
    }
    if (!RELAYED.has(reply.status)) return { ...result, fatal: true };
    result.responses.push({ id: call.id, name: call.name, response: reply.body });
    if (reply.status === 200) {
      const body = reply.body as VoiceFunctionResult;
      result.cart = body.cart;
      if (body.action === 'SHOW_CHECKOUT') result.showCheckout = true;
    }
  }
  return result;
}
