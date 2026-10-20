import type { AddCartLine } from '../application/add-cart-line';
import type { ChangeCartLineQuantity } from '../application/change-cart-line-quantity';
import type { CheckCartReadyForCheckout } from '../application/check-cart-ready-for-checkout';
import type { GetCart } from '../application/get-cart';
import type { RemoveCartLine } from '../application/remove-cart-line';
import { toCartJson } from './http/mapper';

type Json = Record<string, unknown>;

// ให้ voice ใช้กฎ UC-01 ชุดเดียวกับการแตะจอ (UC-03 R7) ผลเป็น JSON ตาม Cart; voice ไม่เห็นภายใน ordering
export function voiceCartOperations(useCases: {
  addCartLine: AddCartLine;
  changeCartLineQuantity: ChangeCartLineQuantity;
  removeCartLine: RemoveCartLine;
  getCart: GetCart;
  checkCartReadyForCheckout: CheckCartReadyForCheckout;
}) {
  return {
    add: async (cartId: string, input: { menuItemId: string; optionChoiceIds: string[]; quantity: number }): Promise<Json> =>
      toCartJson(await useCases.addCartLine.execute({ cartId, ...input })),
    changeQuantity: async (cartId: string, lineId: string, quantity: number): Promise<Json> =>
      toCartJson(await useCases.changeCartLineQuantity.execute({ cartId, lineId, quantity })),
    remove: async (cartId: string, lineId: string): Promise<Json> =>
      toCartJson(await useCases.removeCartLine.execute({ cartId, lineId })),
    view: async (cartId: string): Promise<Json> => toCartJson(await useCases.getCart.execute(cartId)),
    readyForCheckout: async (cartId: string): Promise<Json> =>
      toCartJson(await useCases.checkCartReadyForCheckout.execute(cartId)),
  };
}
