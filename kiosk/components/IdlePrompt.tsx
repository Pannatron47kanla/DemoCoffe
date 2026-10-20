import { useEffect, useRef } from 'react';
import { IDLE_RESET_MS } from '../lib/timing';

// หน้าต่างทับเต็มจอ: การแตะที่ใดก็ได้ถือว่ายังสั่งอยู่ (AC27)
export function IdlePrompt({ onStay, onTimeout }: { onStay: () => void; onTimeout: () => void }) {
  const timeout = useRef(onTimeout);
  timeout.current = onTimeout;
  const stay = useRef(onStay);
  stay.current = onStay;
  useEffect(() => {
    const timer = setTimeout(() => timeout.current(), IDLE_RESET_MS);
    const touched = () => stay.current();
    document.addEventListener('pointerdown', touched);
    document.addEventListener('keydown', touched);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', touched);
      document.removeEventListener('keydown', touched);
    };
  }, []);

  return (
    <div className="dialog idle-prompt" role="alertdialog" aria-label="ยังสั่งอยู่ไหม">
      <div>
        <p>ยังสั่งอยู่ไหม</p>
        <button type="button" onClick={onStay}>ยังสั่งอยู่</button>
      </div>
    </div>
  );
}
