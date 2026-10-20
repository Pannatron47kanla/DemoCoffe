export function WelcomeScreen({ onStart, busy }: { onStart: () => void; busy: boolean }) {
  return (
    <section className="welcome">
      <h1>DemoCoffe</h1>
      <button type="button" className="primary" disabled={busy} onClick={onStart}>เริ่มสั่ง</button>
    </section>
  );
}
