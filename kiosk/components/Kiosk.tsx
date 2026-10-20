'use client';

import { useRef, useState } from 'react';
import { ApiError, type KioskApi } from '../lib/api';
import type { Cart, MenuItem, Order } from '../lib/types';
import type { VoiceLink } from '../lib/voice-link';
import { ConfirmScreen } from './ConfirmScreen';
import { ItemOptionsDialog, type AddInput } from './ItemOptionsDialog';
import { OrderScreen } from './OrderScreen';
import { QueueScreen } from './QueueScreen';
import { WelcomeScreen } from './WelcomeScreen';

type Screen = 'welcome' | 'order' | 'confirm' | 'queue';

export function Kiosk({ api, newIdempotencyKey = () => crypto.randomUUID() }: { api: KioskApi; voice: VoiceLink; newIdempotencyKey?: () => string }) {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [cart, setCart] = useState<Cart | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<MenuItem | null>(null);

  const [problemLineIds, setProblemLineIds] = useState<string[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const keyRef = useRef<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  // แสดง message จาก API ตามที่ได้รับ; error อื่น (เช่น เครือข่าย) แสดงข้อความกลาง
  async function run(action: () => Promise<void>) {
    setError(null);
    setProblemLineIds([]);
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

  function goConfirm() {
    keyRef.current = newIdempotencyKey();
    setScreen('confirm');
  }

  async function place() {
    if (!cart || !keyRef.current) return;
    setBusy(true);
    await run(async () => {
      try {
        setOrder(await api.checkout(cart.id, keyRef.current as string));
        setScreen('queue');
      } catch (e) {
        if (!(e instanceof ApiError)) throw e;
        const { code, details } = e.body;
        if (code === 'PRICE_CHANGED' && details?.cart) {
          setCart(details.cart as Cart);
        } else if (code === 'MENU_ITEM_UNAVAILABLE' && Array.isArray(details?.lineIds)) {
          setProblemLineIds(details.lineIds as string[]);
        } else {
          throw e;
        }
        setScreen('order');
        throw e; // ให้ run() แสดง message จาก API
      }
    });
    setBusy(false);
  }

  return (
    <main className="kiosk">
      {error ? <p className="error banner" role="alert">{error}</p> : null}
      {screen === 'queue' && order ? (
        <QueueScreen order={order} />
      ) : screen === 'welcome' || !cart ? (
        <WelcomeScreen onStart={start} busy={busy} />
      ) : screen === 'confirm' ? (
        <ConfirmScreen cart={cart} busy={busy} onPlace={place} onBack={() => setScreen('order')} />
      ) : (
        <OrderScreen menu={menu} cart={cart} onSelect={setSelected} onChangeQuantity={changeQuantity} onRemove={remove} onConfirm={goConfirm} problemLineIds={problemLineIds} />
      )}
      {selected ? <ItemOptionsDialog item={selected} onAdd={add} onClose={() => setSelected(null)} /> : null}
    </main>
  );
}
