import type { Cart, MenuItem } from '../lib/types';
import { CartPanel } from './CartPanel';
import { MenuGrid } from './MenuGrid';

type Props = {
  menu: MenuItem[];
  cart: Cart;
  onSelect: (item: MenuItem) => void;
  onChangeQuantity: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
  onConfirm: () => void;
  problemLineIds: string[];
};

export function OrderScreen({ menu, cart, onSelect, onChangeQuantity, onRemove, onConfirm, problemLineIds }: Props) {
  return (
    <section className="order">
      <MenuGrid items={menu} onSelect={onSelect} />
      <CartPanel cart={cart} onChangeQuantity={onChangeQuantity} onRemove={onRemove} problemLineIds={problemLineIds} />
      <button type="button" className="confirm" disabled={cart.lines.length === 0} onClick={onConfirm}>ยืนยัน</button>
    </section>
  );
}
