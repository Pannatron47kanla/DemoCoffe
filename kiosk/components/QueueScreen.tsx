import { QRCodeSVG } from 'qrcode.react';
import type { Order } from '../lib/types';

export function QueueScreen({ order }: { order: Order }) {
  return (
    <section className="queue-screen">
      <p>หมายเลขคิวของคุณ</p>
      <p className="queue-number">{order.queueNumber}</p>
      <QRCodeSVG value={order.statusPageUrl} title={order.statusPageUrl} size={240} />
    </section>
  );
}
