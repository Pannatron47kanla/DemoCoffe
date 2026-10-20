import { useEffect, useRef } from 'react';

/** เรียก onIdle เมื่อไม่มี pointerdown/keydown ครบ ms; ปิดนับได้ด้วย enabled=false */
export function useIdle(onIdle: () => void, ms: number, enabled: boolean) {
  const callback = useRef(onIdle);
  callback.current = onIdle;

  useEffect(() => {
    if (!enabled) return;
    let timer = setTimeout(() => callback.current(), ms);
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => callback.current(), ms);
    };
    document.addEventListener('pointerdown', reset);
    document.addEventListener('keydown', reset);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', reset);
      document.removeEventListener('keydown', reset);
    };
  }, [ms, enabled]);
}
