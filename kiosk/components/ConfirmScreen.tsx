import type { Cart } from '../lib/types';

type Props = { cart: Cart; busy: boolean; onPlace: () => void; onBack: () => void };

export function ConfirmScreen({ cart, busy, onPlace, onBack }: Props) {
  return (
    <section className="confirm-screen">
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
      <button type="button" disabled={busy} onClick={onBack}>กลับไปแก้</button>
      <button type="button" disabled={busy} onClick={onPlace}>ยืนยันสั่ง</button>
    </section>
  );
}
