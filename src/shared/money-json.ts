// สตางค์ → JSON เงินตาม openapi.yaml (บาท ทศนิยม 2 ตำแหน่ง)
export type Money = { amount: string; currency: 'THB' };

export function money(satang: number): Money {
  const sign = satang < 0 ? '-' : '';
  const abs = Math.abs(satang);
  return { amount: `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`, currency: 'THB' };
}
