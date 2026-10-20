'use client';

import { useState } from 'react';
import type { KioskApi } from '../lib/api';
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

  async function start() {
    setBusy(true);
    try {
      const [items, newCart] = await Promise.all([api.getMenu(), api.startCart()]);
      setMenu(items.items);
      setCart(newCart);
      setScreen('order');
    } finally {
      setBusy(false);
    }
  }

  async function add(input: AddInput) {
    if (!cart) return;
    setCart(await api.addLine(cart.id, input));
    setSelected(null);
  }

  async function changeQuantity(lineId: string, quantity: number) {
    if (cart) setCart(await api.changeQuantity(cart.id, lineId, quantity));
  }

  async function remove(lineId: string) {
    if (cart) setCart(await api.removeLine(cart.id, lineId));
  }

  return (
    <main className="kiosk">
      {screen === 'welcome' || !cart ? (
        <WelcomeScreen onStart={start} busy={busy} />
      ) : (
        <OrderScreen menu={menu} cart={cart} onSelect={setSelected} onChangeQuantity={changeQuantity} onRemove={remove} />
      )}
      {selected ? <ItemOptionsDialog item={selected} onAdd={add} onClose={() => setSelected(null)} /> : null}
    </main>
  );
}
