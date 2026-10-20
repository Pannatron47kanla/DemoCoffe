'use client';

import { useState } from 'react';
import { ApiError, type KioskApi } from '../lib/api';
import type { Cart, MenuItem } from '../lib/types';
import type { VoiceLink } from '../lib/voice-link';
import { ItemOptionsDialog, type AddInput } from './ItemOptionsDialog';
import { OrderScreen } from './OrderScreen';
import { WelcomeScreen } from './WelcomeScreen';

type Screen = 'welcome' | 'order' | 'confirm' | 'queue';

export function Kiosk({ api }: { api: KioskApi; voice: VoiceLink; newIdempotencyKey?: () => string }) {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [cart, setCart] = useState<Cart | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<MenuItem | null>(null);

  const [error, setError] = useState<string | null>(null);

  // แสดง message จาก API ตามที่ได้รับ; error อื่น (เช่น เครือข่าย) แสดงข้อความกลาง
  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof ApiError ? e.body.message : 'ระบบขัดข้อง กรุณาติดต่อพนักงาน');
    }
  }

  async function start() {
    setBusy(true);
    await run(async () => {
      const [items, newCart] = await Promise.all([api.getMenu(), api.startCart()]);
      setMenu(items.items);
      setCart(newCart);
      setScreen('order');
    });
    setBusy(false);
  }

  const add = (input: AddInput) =>
    run(async () => {
      if (!cart) return;
      setCart(await api.addLine(cart.id, input));
      setSelected(null);
    });

  const changeQuantity = (lineId: string, quantity: number) =>
    run(async () => {
      if (cart) setCart(await api.changeQuantity(cart.id, lineId, quantity));
    });

  const remove = (lineId: string) =>
    run(async () => {
      if (cart) setCart(await api.removeLine(cart.id, lineId));
    });

  return (
    <main className="kiosk">
      {error ? <p className="error banner" role="alert">{error}</p> : null}
      {screen === 'welcome' || !cart ? (
        <WelcomeScreen onStart={start} busy={busy} />
      ) : (
        <OrderScreen menu={menu} cart={cart} onSelect={setSelected} onChangeQuantity={changeQuantity} onRemove={remove} />
      )}
      {selected ? <ItemOptionsDialog item={selected} onAdd={add} onClose={() => setSelected(null)} /> : null}
    </main>
  );
}
