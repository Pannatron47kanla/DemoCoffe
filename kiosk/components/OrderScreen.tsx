import type { Cart, MenuItem } from '../lib/types';
import { CartPanel } from './CartPanel';
import { MenuGrid } from './MenuGrid';

type Props = {
  menu: MenuItem[];
  cart: Cart;
  onSelect: (item: MenuItem) => void;
  onChangeQuantity: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
};

export function OrderScreen({ menu, cart, onSelect, onChangeQuantity, onRemove }: Props) {
  return (
    <section className="order">
      <MenuGrid items={menu} onSelect={onSelect} />
      <CartPanel cart={cart} onChangeQuantity={onChangeQuantity} onRemove={onRemove} />
    </section>
  );
}
