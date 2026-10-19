import { Router, type Request } from 'express';
import { DomainError } from '../../../../shared/domain-error';
import { RequestValidationError } from '../../../../shared/http-errors';
import type { AddCartLine } from '../../application/add-cart-line';
import type { ChangeCartLineQuantity } from '../../application/change-cart-line-quantity';
import type { CheckoutCart } from '../../application/checkout-cart';
import type { GetCart } from '../../application/get-cart';
import type { RemoveCartLine } from '../../application/remove-cart-line';
import type { StartCart } from '../../application/start-cart';
import { toCartJson, toOrderJson } from './mapper';

export interface OrderingUseCases {
  startCart: StartCart;
  getCart: GetCart;
  addCartLine: AddCartLine;
  changeCartLineQuantity: ChangeCartLineQuantity;
  removeCartLine: RemoveCartLine;
  checkoutCart: CheckoutCart;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// id ที่ไม่ใช่ uuid ไม่มีทางมีอยู่จริง ตอบเหมือนไม่พบ (AC13)
function cartIdOf(req: Request): string {
  const cartId = String(req.params.cartId);
  if (!UUID.test(cartId)) throw new DomainError('CART_NOT_FOUND');
  return cartId;
}

function lineIdOf(req: Request): string {
  const lineId = String(req.params.lineId);
  if (!UUID.test(lineId)) throw new DomainError('CART_LINE_NOT_FOUND');
  return lineId;
}

// AC6 ตรวจรูปแบบ input เท่านั้น ช่วงของจำนวน (R4) เป็นกฎใน domain
function addLineBody(body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>;
  const invalid: string[] = [];
  if (typeof b.menuItemId !== 'string' || b.menuItemId === '') invalid.push('menuItemId');
  const optionChoiceIds = b.optionChoiceIds ?? [];
  if (!Array.isArray(optionChoiceIds) || !optionChoiceIds.every((id) => typeof id === 'string')) invalid.push('optionChoiceIds');
  if (!Number.isInteger(b.quantity)) invalid.push('quantity');
  if (invalid.length > 0) throw new RequestValidationError(invalid);
  return { menuItemId: b.menuItemId as string, optionChoiceIds: optionChoiceIds as string[], quantity: b.quantity as number };
}

function quantityOf(body: unknown): number {
  const quantity = (body as Record<string, unknown> | undefined)?.quantity;
  if (!Number.isInteger(quantity)) throw new RequestValidationError(['quantity']);
  return quantity as number;
}

function idempotencyKeyOf(req: Request): string {
  const key = req.header('Idempotency-Key');
  if (!key || key.length > 100) throw new RequestValidationError(['Idempotency-Key']);
  return key;
}

export function orderingRoutes(useCases: OrderingUseCases): Router {
  const router = Router();

  router.post('/carts', async (_req, res) => {
    res.status(201).json(toCartJson(await useCases.startCart.execute()));
  });

  router.get('/carts/:cartId', async (req, res) => {
    res.json(toCartJson(await useCases.getCart.execute(cartIdOf(req))));
  });

  router.post('/carts/:cartId/lines', async (req, res) => {
    const cartId = cartIdOf(req);
    res.json(toCartJson(await useCases.addCartLine.execute({ cartId, ...addLineBody(req.body) })));
  });

  router.patch('/carts/:cartId/lines/:lineId', async (req, res) => {
    const view = await useCases.changeCartLineQuantity.execute({ cartId: cartIdOf(req), lineId: lineIdOf(req), quantity: quantityOf(req.body) });
    res.json(toCartJson(view));
  });

  router.delete('/carts/:cartId/lines/:lineId', async (req, res) => {
    res.json(toCartJson(await useCases.removeCartLine.execute({ cartId: cartIdOf(req), lineId: lineIdOf(req) })));
  });

  router.post('/carts/:cartId/checkout', async (req, res) => {
    const cartId = cartIdOf(req);
    const idempotencyKey = idempotencyKeyOf(req);
    try {
      const { order, replayed } = await useCases.checkoutCart.execute({ cartId, idempotencyKey });
      res.status(replayed ? 200 : 201).json(toOrderJson(order));
    } catch (error) {
      // AC22 แนบตะกร้าที่คิดราคาใหม่แล้วให้ตู้แสดงยอดใหม่ทันที
      if (error instanceof DomainError && error.code === 'PRICE_CHANGED') {
        throw new DomainError('PRICE_CHANGED', { cart: toCartJson(await useCases.getCart.execute(cartId)) });
      }
      throw error;
    }
  });

  return router;
}
