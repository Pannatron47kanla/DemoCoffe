import type { Clock } from '../../shared/clock';
import type { IdGenerator } from '../../shared/ids';
import { AddCartLine } from './application/add-cart-line';
import { ChangeCartLineQuantity } from './application/change-cart-line-quantity';
import { CheckCartAvailability } from './application/check-cart-availability';
import { CheckoutCart } from './application/checkout-cart';
import { GetCart } from './application/get-cart';
import type { MenuLookup, UnitOfWork } from './application/ports';
import { RemoveCartLine } from './application/remove-cart-line';
import { StartCart } from './application/start-cart';
import { toCartJson } from './interface/http/mapper';
import { orderingRoutes } from './interface/http/routes';

// ต่อสายชิ้นส่วนของ ordering; main.ts ส่ง uow (Postgres) และ menu (จาก context menu) เข้ามา
export function createOrderingModule(deps: { uow: UnitOfWork; menu: MenuLookup; clock: Clock; ids: IdGenerator }) {
  const useCases = {
    startCart: new StartCart(deps),
    getCart: new GetCart(deps),
    addCartLine: new AddCartLine(deps),
    changeCartLineQuantity: new ChangeCartLineQuantity(deps),
    removeCartLine: new RemoveCartLine(deps),
    checkoutCart: new CheckoutCart(deps),
  };
  const cartAvailability = new CheckCartAvailability(deps);
  // ให้ voice ใช้กฎ UC-01 ชุดเดียวกับการแตะจอ (UC-03 R7) ผลเป็น JSON ตาม Cart; voice ไม่เห็นภายใน ordering
  const voiceCart = {
    add: async (cartId: string, input: { menuItemId: string; optionChoiceIds: string[]; quantity: number }) =>
      toCartJson(await useCases.addCartLine.execute({ cartId, ...input })),
    changeQuantity: async (_cartId: string, _lineId: string, _quantity: number): Promise<Record<string, unknown>> => {
      throw new Error('not implemented');
    },
    remove: async (_cartId: string, _lineId: string): Promise<Record<string, unknown>> => {
      throw new Error('not implemented');
    },
    view: async (_cartId: string): Promise<Record<string, unknown>> => {
      throw new Error('not implemented');
    },
    readyForCheckout: async (_cartId: string): Promise<Record<string, unknown>> => {
      throw new Error('not implemented');
    },
  };
  return { useCases, cartAvailability, voiceCart, router: orderingRoutes(useCases) };
}
