'use client';

import { useState } from 'react';
import type { KioskApi } from '../lib/api';
import type { Cart, MenuItem } from '../lib/types';
import type { VoiceLink } from '../lib/voice-link';
import { OrderScreen } from './OrderScreen';
import { WelcomeScreen } from './WelcomeScreen';

type Screen = 'welcome' | 'order' | 'confirm' | 'queue';

export function Kiosk({ api }: { api: KioskApi; voice: VoiceLink; newIdempotencyKey?: () => string }) {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [cart, setCart] = useState<Cart | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [busy, setBusy] = useState(false);

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

  return (
    <main className="kiosk">
      {screen === 'welcome' || !cart ? (
        <WelcomeScreen onStart={start} busy={busy} />
      ) : (
        <OrderScreen menu={menu} cart={cart} onSelect={() => undefined} />
      )}
    </main>
  );
}
