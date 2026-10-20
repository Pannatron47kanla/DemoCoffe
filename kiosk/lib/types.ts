// ตรงกับ schema ใน openapi.yaml (เขียนเอง ไม่ generate)
export type Money = { amount: string; currency: 'THB' };
export type MenuOptionGroup = { id: string; name: string; required: boolean; choices: { id: string; name: string; priceDelta: Money }[] };
export type MenuItem = { id: string; name: string; basePrice: Money; available: boolean; optionGroups: MenuOptionGroup[] };
export type ChosenOption = { choiceId: string; groupName: string; name: string; priceDelta: Money };
export type CartLine = { id: string; menuItemId: string; name: string; options: ChosenOption[]; quantity: number; unitPrice: Money; lineTotal: Money };
export type Cart = { id: string; status: 'OPEN' | 'CHECKED_OUT'; expiresAt: string; lines: CartLine[]; totalCups: number; total: Money };
export type OrderLine = Omit<CartLine, 'id'>;
export type Order = { id: string; cartId: string; status: 'PLACED'; queueNumber: number; placedAt: string; lines: OrderLine[]; total: Money; statusPageUrl: string };
export type CustomerOrder = Omit<Order, 'cartId' | 'statusPageUrl'>;
export type VoiceSession = { id: string; cartId: string; consentTextVersion: string; consentedAt: string; connection: { token: string; model: string; startBefore: string } };
export type VoiceFunctionResult = { action: 'SHOW_CART' | 'SHOW_CHECKOUT'; cart: Cart };
export type ApiErrorBody = { code: string; message: string; details?: Record<string, unknown> };
