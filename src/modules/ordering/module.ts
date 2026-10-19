import type { Clock } from '../../shared/clock';
import type { IdGenerator } from '../../shared/ids';
import { AddCartLine } from './application/add-cart-line';
import { ChangeCartLineQuantity } from './application/change-cart-line-quantity';
import { CheckoutCart } from './application/checkout-cart';
import { GetCart } from './application/get-cart';
import type { MenuLookup, UnitOfWork } from './application/ports';
import { RemoveCartLine } from './application/remove-cart-line';
import { StartCart } from './application/start-cart';
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
  return { useCases, router: orderingRoutes(useCases) };
}
