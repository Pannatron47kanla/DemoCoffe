import type { Cart, MenuItem } from '../lib/types';
import { CartPanel } from './CartPanel';
import { MenuGrid } from './MenuGrid';

export function OrderScreen({ menu, cart, onSelect }: { menu: MenuItem[]; cart: Cart; onSelect: (item: MenuItem) => void }) {
  return (
    <section className="order">
      <MenuGrid items={menu} onSelect={onSelect} />
      <CartPanel cart={cart} />
    </section>
  );
}
