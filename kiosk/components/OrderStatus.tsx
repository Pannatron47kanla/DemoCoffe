'use client';

import { useEffect, useState } from 'react';
import type { KioskApi } from '../lib/api';
import type { CustomerOrder } from '../lib/types';

type Props = { api: KioskApi; orderId: string | null };

export function OrderStatus({ api, orderId }: Props) {
  const [order, setOrder] = useState<CustomerOrder | null>(null);

  useEffect(() => {
    if (orderId === null) return;
    let active = true;
    api.getOrder(orderId).then((o) => {
      if (active) setOrder(o);
    });
    return () => {
      active = false;
    };
  }, [api, orderId]);

  if (!order) return <main className="status-page" />;

  return (
    <main className="status-page">
      <p className="status-label">คิวของคุณ</p>
      <p className="queue-number">{order.queueNumber}</p>
      <p className="status-text">รับออเดอร์แล้ว</p>
      <ul>
        {order.lines.map((line, index) => (
          <li key={index}>
            <span className="name">{line.name}</span>
            {line.options.map((o) => (
              <span key={o.choiceId} className="option">{o.name}</span>
            ))}
            <span className="qty">x{line.quantity}</span>
            <span className="line-total">{line.lineTotal.amount}</span>
          </li>
        ))}
      </ul>
      <p className="total">{order.total.amount}</p>
    </main>
  );
}
