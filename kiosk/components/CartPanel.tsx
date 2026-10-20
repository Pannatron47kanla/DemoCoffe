import type { Cart } from '../lib/types';

export function CartPanel({ cart }: { cart: Cart }) {
  return (
    <aside className="cart" aria-label="ตะกร้า">
      <ul>
        {cart.lines.map((line) => (
          <li key={line.id}>
            <span className="name">{line.name}</span>
            {line.options.map((o) => (
              <span key={o.choiceId} className="option">{o.name}</span>
            ))}
            <span className="qty">x{line.quantity}</span>
            <span className="line-total">{line.lineTotal.amount}</span>
          </li>
        ))}
      </ul>
      <p className="total">{cart.total.amount}</p>
    </aside>
  );
}
