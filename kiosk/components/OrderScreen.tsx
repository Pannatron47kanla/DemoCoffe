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
  voiceOn: boolean;
  voiceConnecting: boolean;
  onVoice: () => void;
};

export function OrderScreen({ menu, cart, onSelect, onChangeQuantity, onRemove, onConfirm, problemLineIds, voiceOn, voiceConnecting, onVoice }: Props) {
  return (
    <section className="order">
      <MenuGrid items={menu} onSelect={onSelect} />
      <CartPanel cart={cart} onChangeQuantity={onChangeQuantity} onRemove={onRemove} problemLineIds={problemLineIds} />
      <button type="button" className="voice" disabled={voiceConnecting} onClick={onVoice}>{voiceConnecting ? 'กำลังเชื่อมต่อ…' : voiceOn ? '⏹ หยุดเสียง' : '🎤 สั่งด้วยเสียง'}</button>
      <button type="button" className="confirm" disabled={cart.lines.length === 0} onClick={onConfirm}>ยืนยัน</button>
    </section>
  );
}
