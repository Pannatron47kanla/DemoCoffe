'use client';

import { useEffect, useState } from 'react';
import { ApiError, type KioskApi } from '../lib/api';
import type { CustomerOrder } from '../lib/types';

type Props = { api: KioskApi; orderId: string | null };

const NOT_FOUND = 'ไม่พบออเดอร์';
const FAILURE = 'ระบบขัดข้อง กรุณาติดต่อพนักงาน';

export function OrderStatus({ api, orderId }: Props) {
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    let active = true;
    api.getOrder(orderId).then(
      (o) => {
        if (active) setOrder(o);
      },
      (e: unknown) => {
        if (!active) return;
        setError(e instanceof ApiError && e.status === 404 ? NOT_FOUND : FAILURE);
      },
    );
    return () => {
      active = false;
    };
  }, [api, orderId]);

  if (!orderId) return <main className="status-page"><p className="error">{NOT_FOUND}</p></main>;
  if (error) return <main className="status-page"><p className="error">{error}</p></main>;
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
