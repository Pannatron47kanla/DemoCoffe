import type { ApiErrorBody, Cart, CustomerOrder, MenuItem, Order, VoiceSession } from './types';

export class ApiError extends Error {
  constructor(readonly status: number, readonly body: ApiErrorBody) {
    super(body.message);
  }
}

export interface KioskApi {
  getMenu(): Promise<{ items: MenuItem[] }>;
  startCart(): Promise<Cart>;
  addLine(cartId: string, input: { menuItemId: string; optionChoiceIds: string[]; quantity: number }): Promise<Cart>;
  changeQuantity(cartId: string, lineId: string, quantity: number): Promise<Cart>;
  removeLine(cartId: string, lineId: string): Promise<Cart>;
  checkout(cartId: string, idempotencyKey: string): Promise<Order>;
  getOrder(orderId: string): Promise<CustomerOrder>;
  getConsentText(): Promise<{ version: string; text: string }>;
  startVoiceSession(cartId: string, consentTextVersion: string): Promise<VoiceSession>;
  /** คืน status + body ทุกกรณี ไม่ throw ตาม status (ใช้ส่งต่อให้ Gemini) */
  callVoiceFunction(sessionId: string, call: { name: string; args: Record<string, unknown> }): Promise<{ status: number; body: unknown }>;
}

export function createApi(baseUrl = '', fetchImpl: typeof fetch = (...args) => fetch(...args)): KioskApi {
  async function send(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const hasBody = body !== undefined;
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers: { ...(hasBody ? { 'Content-Type': 'application/json' } : {}), ...headers },
      ...(hasBody ? { body: JSON.stringify(body) } : {}),
    });
    const parsed: unknown = await response.json().catch(() => undefined);
    return { status: response.status, ok: response.ok, body: parsed };
  }

  async function request<T>(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    const result = await send(method, path, body, headers);
    if (!result.ok) {
      const error = result.body as ApiErrorBody | undefined;
      throw new ApiError(result.status, error?.code && error.message ? error : { code: 'UNKNOWN', message: `คำขอล้มเหลว (${result.status})` });
    }
    return result.body as T;
  }

  return {
    getMenu: () => request('GET', '/menu'),
    startCart: () => request('POST', '/carts'),
    addLine: (cartId, input) => request('POST', `/carts/${cartId}/lines`, input),
    changeQuantity: (cartId, lineId, quantity) => request('PATCH', `/carts/${cartId}/lines/${lineId}`, { quantity }),
    removeLine: (cartId, lineId) => request('DELETE', `/carts/${cartId}/lines/${lineId}`),
    checkout: (cartId, idempotencyKey) => request('POST', `/carts/${cartId}/checkout`, undefined, { 'Idempotency-Key': idempotencyKey }),
    getOrder: (orderId) => request('GET', `/orders/${encodeURIComponent(orderId)}`),
    getConsentText: () => request('GET', '/voice/consent-text'),
    startVoiceSession: (cartId, consentTextVersion) => request('POST', '/voice/sessions', { cartId, consentTextVersion }),
    callVoiceFunction: async (sessionId, call) => {
      const { status, body } = await send('POST', `/voice/sessions/${sessionId}/function-calls`, call);
      return { status, body };
    },
  };
}
