type Props = { text: string; onAccept: () => void; onDecline: () => void };

// ปุ่มทั้งสองใช้ class เดียวกัน ขนาดจึงเท่ากันเสมอ
export function ConsentSheet({ text, onAccept, onDecline }: Props) {
  return (
    <div className="dialog consent-sheet" role="dialog" aria-label="ข้อความยินยอม">
      <div>
        <p>{text}</p>
        <div className="consent-actions">
          <button type="button" className="consent-button" onClick={onAccept}>ยินยอม</button>
          <button type="button" className="consent-button" onClick={onDecline}>ไม่ใช่ตอนนี้</button>
        </div>
      </div>
    </div>
  );
}
