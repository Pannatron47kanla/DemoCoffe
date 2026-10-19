import { DomainError } from '../../../shared/domain-error';
import type { Cart } from '../domain/cart';
import type { OrderableItem } from '../domain/orderable-item';
import type { CartRepository } from '../domain/repositories';
import type { MenuLookup } from './ports';

// ตะกร้าพร้อมเมนูของรายการ ให้ชั้น interface แสดงชื่อและตัวเลือกได้
export interface CartView {
  cart: Cart;
  items: OrderableItem[];
}

export async function viewOf(cart: Cart, menu: MenuLookup): Promise<CartView> {
  return { cart, items: await menu.findByIds(menuItemIdsOf(cart)) };
}

export function menuItemIdsOf(cart: Cart): string[] {
  return [...new Set(cart.lines.map((line) => line.menuItemId))];
}

export async function requireCart(carts: CartRepository, cartId: string): Promise<Cart> {
  const cart = await carts.findById(cartId);
  if (!cart) throw new DomainError('CART_NOT_FOUND');
  return cart;
}
