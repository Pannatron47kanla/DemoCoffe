'use client';

import { useEffect, useRef, useState } from 'react';
import { ApiError, type KioskApi } from '../lib/api';
import type { Cart, MenuItem, Order } from '../lib/types';
import { EXPIRED_NOTICE_MS, IDLE_PROMPT_MS, QUEUE_RETURN_MS } from '../lib/timing';
import type { VoiceLink, VoiceLinkSession } from '../lib/voice-link';
import { useIdle } from '../lib/use-idle';
import { ConsentSheet } from './ConsentSheet';
import { ConfirmScreen } from './ConfirmScreen';
import { IdlePrompt } from './IdlePrompt';
import { ItemOptionsDialog, type AddInput } from './ItemOptionsDialog';
import { OrderScreen } from './OrderScreen';
import { QueueScreen } from './QueueScreen';
import { WelcomeScreen } from './WelcomeScreen';

type Screen = 'welcome' | 'order' | 'confirm' | 'queue';

export function Kiosk({ api, voice, newIdempotencyKey = () => crypto.randomUUID() }: { api: KioskApi; voice: VoiceLink; newIdempotencyKey?: () => string }) {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [cart, setCart] = useState<Cart | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<MenuItem | null>(null);

  const [problemLineIds, setProblemLineIds] = useState<string[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const keyRef = useRef<string | null>(null);

  const [expired, setExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idlePrompt, setIdlePrompt] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const voiceRef = useRef<VoiceLinkSession | null>(null);
  const [consent, setConsent] = useState<{ version: string; text: string } | null>(null);

  // แสดง message จาก API ตามที่ได้รับ; error อื่น (เช่น เครือข่าย) แสดงข้อความกลาง
  async function run(action: () => Promise<void>) {
    setError(null);
    setProblemLineIds([]);
    try {
      await action();
    } catch (e) {
      setError(e instanceof ApiError ? e.body.message : 'ระบบขัดข้อง กรุณาติดต่อพนักงาน');
      if (e instanceof ApiError && e.body.code === 'CART_EXPIRED') setExpired(true);
    }
  }

  // กลับหน้าต้อนรับ: ล้างตะกร้า ออเดอร์ error และรายการที่มีปัญหา
  function resetToWelcome() {
    setExpired(false);
    setIdlePrompt(false);
    setError(null);
    setCart(null);
    setOrder(null);
    setSelected(null);
    setConsent(null);
    setProblemLineIds([]);
    setScreen('welcome');
  }

  // ตะกร้าหมดอายุ: แสดงข้อความค้างไว้ครู่หนึ่งแล้วกลับหน้าต้อนรับ
  useEffect(() => {
    if (!expired) return;
    const timer = setTimeout(resetToWelcome, EXPIRED_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [expired]);

  // หน้าคิว: กลับหน้าต้อนรับเองหลังครบเวลา
  useEffect(() => {
    if (screen !== 'queue') return;
    const timer = setTimeout(resetToWelcome, QUEUE_RETURN_MS);
    return () => clearTimeout(timer);
  }, [screen]);

  // ไม่แตะนาน: ถามว่ายังสั่งอยู่ไหม (หน้าสั่งและหน้ายืนยัน) enabled จะถูกปิดเมื่อเปิดเสียงในงานถัดไป
  const idleScreen = screen === 'order' || screen === 'confirm';
  const idleEnabled = idleScreen && !idlePrompt;
  // ออกจากหน้าสั่ง/ยืนยัน (เช่นยืนยันสั่งสำเร็จ) ต้องล้างคำถามที่ค้าง ไม่ให้ไปตัดหน้าคิว
  useEffect(() => {
    if (!idleScreen) setIdlePrompt(false);
  }, [idleScreen]);
  useIdle(() => setIdlePrompt(true), IDLE_PROMPT_MS, idleEnabled);

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

  const openConsent = () =>
    run(async () => {
      setConsent(await api.getConsentText());
    });

  // ยินยอมแล้ว: ขอเซสชันจาก api (ส่งเวอร์ชันที่แสดงจริง) แล้วเปิดเสียงด้วยโทเคนที่ได้
  async function acceptConsent() {
    if (!consent || !cart) return;
    const { version } = consent;
    setConsent(null);
    await run(async () => {
      const session = await api.startVoiceSession(cart.id, version);
      voiceRef.current = await voice.connect(session.connection, {
        onFunctionCalls: () => {},
        onTranscript: () => {},
        onClose: () => {
          voiceRef.current = null;
          setVoiceOn(false);
        },
      });
      setVoiceOn(true);
    });
  }

  function stopVoice() {
    voiceRef.current?.close();
    voiceRef.current = null;
    setVoiceOn(false);
  }

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
        <QueueScreen order={order} onDone={resetToWelcome} />
      ) : screen === 'welcome' || !cart ? (
        <WelcomeScreen onStart={start} busy={busy} />
      ) : screen === 'confirm' ? (
        <ConfirmScreen cart={cart} busy={busy} onPlace={place} onBack={() => setScreen('order')} />
      ) : (
        <OrderScreen menu={menu} cart={cart} onSelect={setSelected} onChangeQuantity={changeQuantity} onRemove={remove} onConfirm={goConfirm} problemLineIds={problemLineIds} voiceOn={voiceOn} onVoice={voiceOn ? stopVoice : openConsent} />
      )}
      {idlePrompt ? <IdlePrompt onStay={() => setIdlePrompt(false)} onTimeout={resetToWelcome} /> : null}
      {consent ? <ConsentSheet text={consent.text} onAccept={acceptConsent} onDecline={() => setConsent(null)} /> : null}
      {selected ? <ItemOptionsDialog item={selected} onAdd={add} onClose={() => setSelected(null)} /> : null}
    </main>
  );
}
