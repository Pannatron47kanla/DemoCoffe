import { QRCodeSVG } from 'qrcode.react';
import type { Order } from '../lib/types';

export function QueueScreen({ order, onDone }: { order: Order; onDone: () => void }) {
  return (
    <section className="queue-screen">
      <p>หมายเลขคิวของคุณ</p>
      <p className="queue-number">{order.queueNumber}</p>
      <QRCodeSVG value={order.statusPageUrl} title={order.statusPageUrl} size={240} />
      <button type="button" onClick={onDone}>เสร็จสิ้น</button>
    </section>
  );
}
