'use client';

import { useEffect, useRef, useState } from 'react';
import { ApiError, type KioskApi } from '../lib/api';
import type { Cart, MenuItem, Order } from '../lib/types';
import { EXPIRED_NOTICE_MS, IDLE_PROMPT_MS, QUEUE_RETURN_MS } from '../lib/timing';
import type { FunctionCall, VoiceLink, VoiceLinkSession } from '../lib/voice-link';
import { relayFunctionCalls } from '../lib/voice-relay';
import { useIdle } from '../lib/use-idle';
import { CaptionBox, type Caption } from './CaptionBox';
import { ConsentSheet } from './ConsentSheet';
import { ConfirmScreen } from './ConfirmScreen';
import { IdlePrompt } from './IdlePrompt';
import { ItemOptionsDialog, type AddInput } from './ItemOptionsDialog';
import { OrderScreen } from './OrderScreen';
import { QueueScreen } from './QueueScreen';
import { WelcomeScreen } from './WelcomeScreen';

const MAX_CAPTIONS = 6;
const VOICE_UNAVAILABLE = 'ใช้เสียงไม่ได้ตอนนี้ สั่งด้วยการแตะได้เลย';

type Screen = 'welcome' | 'order' | 'confirm' | 'queue';

// ข้อความต่อเนื่องของคนเดิมต่อท้ายบรรทัดล่าสุด; เก็บแค่ไม่กี่บรรทัดล่าสุด
function appendCaption(prev: Caption[], role: Caption['role'], text: string): Caption[] {
  const last = prev[prev.length - 1];
  const next = last?.role === role ? [...prev.slice(0, -1), { role, text: last.text + text }] : [...prev, { role, text }];
  return next.slice(-MAX_CAPTIONS);
}

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
  const startTokenRef = useRef(0); // เพิ่มทุกครั้งที่หยุด/กลับต้อนรับ เพื่อทิ้งการเปิดเสียงที่ค้างอยู่
  const startingRef = useRef<number | null>(null);
  const consentedRef = useRef<{ cartId: string; version: string } | null>(null); // ตะกร้านี้ยินยอมแล้ว ไม่ถามซ้ำ
  const [captions, setCaptions] = useState<Caption[]>([]);
  const screenRef = useRef<Screen>('welcome');
  screenRef.current = screen;
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
    stopVoice();
    setCaptions([]);
    setExpired(false);
    setIdlePrompt(false);
    setError(null);
    setCart(null);
    setOrder(null);
    setSelected(null);
    setConsent(null);
    consentedRef.current = null;
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

  // ไม่แตะนาน: ถามว่ายังสั่งอยู่ไหม (หน้าสั่งและหน้ายืนยัน) ปิดนับเมื่อเปิดเสียง (AC27)
  const idleScreen = screen === 'order' || screen === 'confirm';
  const idleEnabled = idleScreen && !idlePrompt && !voiceOn;
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
    await startVoice(cart.id, version);
  }

  // ตะกร้าเดิมที่ยินยอมแล้วเปิดเสียงใหม่ได้เลย ไม่แสดงแผ่นยินยอมอีก
  function toggleVoice() {
    if (voiceOn) return stopVoice();
    if (cart && consentedRef.current?.cartId === cart.id) return startVoice(cart.id, consentedRef.current.version);
    return openConsent();
  }

  async function startVoice(cartId: string, version: string) {
    if (startingRef.current !== null) return; // กำลังเปิดเสียงอยู่ ไม่เปิดซ้อน
    const token = ++startTokenRef.current;
    startingRef.current = token;
    await run(async () => {
      try {
        await openVoice(cartId, version, token);
      } catch (e) {
        if (startTokenRef.current !== token) return;
        // ตะกร้าหมดอายุใช้กฎเดียวกับทุกที่; อย่างอื่นคือเปิดเสียงไม่ได้ ให้แตะสั่งต่อ
        if (e instanceof ApiError && e.body.code === 'CART_EXPIRED') throw e;
        setError(VOICE_UNAVAILABLE);
      }
    });
    if (startingRef.current === token) startingRef.current = null;
  }

  async function openVoice(cartId: string, version: string, token: number) {
    const session = await api.startVoiceSession(cartId, version);
    if (startTokenRef.current !== token) return;
    consentedRef.current = { cartId, version };
    // batch ที่ซ้อนกันต่อคิวทีละชุด เพื่อให้ response ถึง Gemini ตามลำดับ
    let chain: Promise<void> = Promise.resolve();
    const slot: { link?: VoiceLinkSession } = {};
    const mine = () => slot.link !== undefined && voiceRef.current === slot.link;
    const link = await voice.connect(session.connection, {
      onFunctionCalls: (calls) => {
        chain = chain.then(() => relay(session.id, calls, mine)).catch(() => voiceFailed(mine));
      },
      onTranscript: (role, text) => {
        if (mine()) setCaptions((prev) => appendCaption(prev, role, text));
      },
      onClose: (reason) => {
        if (!mine()) return;
        if (reason === 'error') voiceFailed(mine);
        else stopVoice();
      },
    });
    if (startTokenRef.current !== token) {
      link.close(); // ระหว่างรอ มีการหยุด/กลับหน้าต้อนรับไปแล้ว
      return;
    }
    slot.link = link;
    voiceRef.current = link;
    setVoiceOn(true);
  }

  // ส่ง function call ของ Gemini ต่อให้ api แล้วตอบกลับตามที่ได้รับ; fatal = ปิดเสียง กลับไปแตะจอ
  // mine() = เซสชันนี้ยังเป็นเซสชันปัจจุบัน (หยุดแล้วเปิดใหม่ ของเก่าต้องไม่แตะของใหม่)
  async function relay(sessionId: string, calls: FunctionCall[], mine: () => boolean) {
    if (!mine()) return;
    const result = await relayFunctionCalls(api, sessionId, calls);
    if (!mine()) return;
    if (result.fatal) {
      voiceFailed(mine);
      return;
    }
    if (result.cart) setCart(result.cart);
    if (result.showCheckout && screenRef.current === 'order') goConfirm();
    voiceRef.current?.sendFunctionResponses(result.responses);
  }

  function voiceFailed(mine: () => boolean) {
    if (!mine()) return;
    stopVoice();
    setError(VOICE_UNAVAILABLE);
  }

  function stopVoice() {
    startTokenRef.current += 1;
    startingRef.current = null;
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
        stopVoice(); // ออเดอร์เสร็จแล้ว ปิดเสียงและไมค์ ล้างคำบรรยาย (R6)
        setCaptions([]);
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
        <OrderScreen menu={menu} cart={cart} onSelect={setSelected} onChangeQuantity={changeQuantity} onRemove={remove} onConfirm={goConfirm} problemLineIds={problemLineIds} voiceOn={voiceOn} onVoice={toggleVoice} />
      )}
      {screen === 'order' || screen === 'confirm' ? <CaptionBox captions={captions} /> : null}
      {idlePrompt ? <IdlePrompt onStay={() => setIdlePrompt(false)} onTimeout={resetToWelcome} /> : null}
      {consent ? <ConsentSheet text={consent.text} onAccept={acceptConsent} onDecline={() => setConsent(null)} /> : null}
      {selected ? <ItemOptionsDialog item={selected} onAdd={add} onClose={() => setSelected(null)} /> : null}
    </main>
  );
}
