import menuJson from '../../../data/menu.json';
import type { KioskApi } from '../../lib/api';
import type { Cart, CartLine, MenuItem, Money } from '../../lib/types';

type Method = keyof KioskApi;

const money = (satang: number): Money => ({ amount: (satang / 100).toFixed(2), currency: 'THB' });

type RawItem = (typeof menuJson.items)[number];
const toMenuItem = (raw: RawItem): MenuItem => ({
  id: raw.id,
  name: raw.name,
  basePrice: money(raw.basePriceSatang),
  available: raw.available,
  optionGroups: raw.optionGroups.map((g) => ({
    id: g.id,
    name: g.name,
    required: g.required,
    choices: g.choices.map((c) => ({ id: c.id, name: c.name, priceDelta: money(c.priceDeltaSatang) })),
  })),
});

const METHODS: Method[] = [
  'getMenu', 'startCart', 'addLine', 'changeQuantity', 'removeLine', 'checkout', 'getOrder',
  'getConsentText', 'startVoiceSession', 'callVoiceFunction',
];

export function fakeApi(overrides: Partial<KioskApi> = {}): KioskApi & { calls: Record<Method, unknown[][]> } {
  const rawItems = menuJson.items;
  const menu = rawItems.map(toMenuItem);
  const cartId = 'cart-1';
  let lines: (CartLine & { unitSatang: number })[] = [];
  let seq = 0;

  const snapshot = (): Cart => {
    const total = lines.reduce((sum, l) => sum + l.unitSatang * l.quantity, 0);
    return {
      id: cartId,
      status: 'OPEN',
      expiresAt: '2026-10-19T02:46:00Z',
      lines: lines.map(({ unitSatang: _u, ...line }) => line),
      totalCups: lines.reduce((sum, l) => sum + l.quantity, 0),
      total: money(total),
    };
  };
  const reprice = (l: CartLine & { unitSatang: number }) => ({ ...l, lineTotal: money(l.unitSatang * l.quantity) });

  const defaults: KioskApi = {
    getMenu: async () => ({ items: menu }),
    startCart: async () => {
      lines = [];
      return snapshot();
    },
    addLine: async (_id, input) => {
      const raw = rawItems.find((i) => i.id === input.menuItemId);
      if (!raw) throw new Error('unknown item');
      const item = toMenuItem(raw);
      const chosen = input.optionChoiceIds.map((choiceId) => {
        const group = item.optionGroups.find((g) => g.choices.some((c) => c.id === choiceId));
        const choice = group?.choices.find((c) => c.id === choiceId);
        if (!group || !choice) throw new Error('unknown choice');
        return { choiceId, groupName: group.name, name: choice.name, priceDelta: choice.priceDelta };
      });
      const unitSatang = raw.basePriceSatang + chosen.reduce((s, o) => s + Math.round(Number(o.priceDelta.amount) * 100), 0);
      seq += 1;
      lines = [...lines, reprice({
        id: `line-${seq}`, menuItemId: item.id, name: item.name, options: chosen,
        quantity: input.quantity, unitPrice: money(unitSatang), lineTotal: money(0), unitSatang,
      })];
      return snapshot();
    },
    changeQuantity: async (_id, lineId, quantity) => {
      lines = lines.map((l) => (l.id === lineId ? reprice({ ...l, quantity }) : l));
      return snapshot();
    },
    removeLine: async (_id, lineId) => {
      lines = lines.filter((l) => l.id !== lineId);
      return snapshot();
    },
    checkout: async () => {
      throw new Error('not implemented in fake');
    },
    getOrder: async () => {
      throw new Error('not implemented in fake');
    },
    getConsentText: async () => ({ version: 'v1', text: 'ข้อความยินยอม' }),
    startVoiceSession: async () => {
      throw new Error('not implemented in fake');
    },
    callVoiceFunction: async () => ({ status: 200, body: {} }),
  };

  const calls = Object.fromEntries(METHODS.map((m) => [m, [] as unknown[][]])) as Record<Method, unknown[][]>;
  const api = { calls } as KioskApi & { calls: Record<Method, unknown[][]> };
  for (const method of METHODS) {
    const impl = (overrides[method] ?? defaults[method]) as (...args: unknown[]) => Promise<unknown>;
    (api as unknown as Record<string, unknown>)[method] = (...args: unknown[]) => {
      calls[method].push(args);
      return impl(...args);
    };
  }
  return api;
}
