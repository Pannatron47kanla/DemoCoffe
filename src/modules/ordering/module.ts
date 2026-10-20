import type { Clock } from '../../shared/clock';
import type { IdGenerator } from '../../shared/ids';
import { AddCartLine } from './application/add-cart-line';
import { ChangeCartLineQuantity } from './application/change-cart-line-quantity';
import { CheckCartAvailability } from './application/check-cart-availability';
import { CheckCartReadyForCheckout } from './application/check-cart-ready-for-checkout';
import { CheckoutCart } from './application/checkout-cart';
import { GetCart } from './application/get-cart';
import { GetOrder } from './application/get-order';
import type { MenuLookup, UnitOfWork } from './application/ports';
import { RemoveCartLine } from './application/remove-cart-line';
import { StartCart } from './application/start-cart';
import { orderingRoutes } from './interface/http/routes';
import { voiceCartOperations } from './interface/voice-cart';

// ต่อสายชิ้นส่วนของ ordering; main.ts ส่ง uow (Postgres) และ menu (จาก context menu) เข้ามา
export function createOrderingModule(deps: { uow: UnitOfWork; menu: MenuLookup; clock: Clock; ids: IdGenerator }) {
  const useCases = {
    startCart: new StartCart(deps),
    getCart: new GetCart(deps),
    addCartLine: new AddCartLine(deps),
    changeCartLineQuantity: new ChangeCartLineQuantity(deps),
    removeCartLine: new RemoveCartLine(deps),
    checkoutCart: new CheckoutCart(deps),
    getOrder: new GetOrder(deps),
  };
  const voiceUseCases = { ...useCases, checkCartReadyForCheckout: new CheckCartReadyForCheckout(deps) };
  const cartAvailability = new CheckCartAvailability(deps);
  const voiceCart = voiceCartOperations(voiceUseCases);
  return { useCases, cartAvailability, voiceCart, router: orderingRoutes(useCases) };
}
