import type { Cart } from '../lib/types';

type Props = {
  cart: Cart;
  onChangeQuantity: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
  problemLineIds: string[];
};

export function CartPanel({ cart, onChangeQuantity, onRemove, problemLineIds }: Props) {
  return (
    <aside className="cart" aria-label="ตะกร้า">
      <ul>
        {cart.lines.map((line) => (
          <li key={line.id} data-problem={problemLineIds.includes(line.id) ? 'true' : undefined}>
            <span className="name">{line.name}</span>
            {line.options.map((o) => (
              <span key={o.choiceId} className="option">{o.name}</span>
            ))}
            <span className="qty-controls">
              <button type="button" aria-label="−" disabled={line.quantity <= 1} onClick={() => onChangeQuantity(line.id, line.quantity - 1)}>−</button>
              <span className="qty">x{line.quantity}</span>
              <button type="button" aria-label="+" onClick={() => onChangeQuantity(line.id, line.quantity + 1)}>+</button>
            </span>
            <span className="line-total">{line.lineTotal.amount}</span>
            <button type="button" onClick={() => onRemove(line.id)}>ลบ</button>
          </li>
        ))}
      </ul>
      <p className="total">{cart.total.amount}</p>
    </aside>
  );
}
