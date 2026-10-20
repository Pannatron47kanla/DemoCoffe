import { useEffect, useRef } from 'react';
import { IDLE_RESET_MS } from '../lib/timing';

export function IdlePrompt({ onStay, onTimeout }: { onStay: () => void; onTimeout: () => void }) {
  const timeout = useRef(onTimeout);
  timeout.current = onTimeout;
  useEffect(() => {
    const timer = setTimeout(() => timeout.current(), IDLE_RESET_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="idle-prompt" role="alertdialog" aria-label="ยังสั่งอยู่ไหม">
      <p>ยังสั่งอยู่ไหม</p>
      <button type="button" onClick={onStay}>ยังสั่งอยู่</button>
    </div>
  );
}
