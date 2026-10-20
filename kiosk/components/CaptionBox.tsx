export type Caption = { role: 'user' | 'model'; text: string };

// คำบรรยายเสียงบนจอเท่านั้น (R6) ไม่ส่งไป api ไม่เก็บใน storage
export function CaptionBox({ captions }: { captions: Caption[] }) {
  if (captions.length === 0) return null;
  return (
    <div className="captions" aria-live="polite">
      {captions.map((c, i) => (
        <p key={i} className={`caption ${c.role}`}>{`${c.role === 'user' ? '👤' : '🤖'} ${c.text}`}</p>
      ))}
    </div>
  );
}
