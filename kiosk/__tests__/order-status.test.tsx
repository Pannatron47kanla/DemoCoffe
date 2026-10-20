// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { OrderStatus } from '../components/OrderStatus';
import type { CustomerOrder } from '../lib/types';
import { fakeApi } from './support/fake-api';

afterEach(cleanup);

const queue17: CustomerOrder = {
  id: '0c6a4f2e-9d1b-4e3a-8f5c-6b7a8d9e0f12',
  status: 'PLACED',
  queueNumber: 17,
  placedAt: '2026-10-20T02:30:00Z',
  lines: [{
    menuItemId: 'latte',
    name: 'ลาเต้',
    options: [
      { choiceId: 'size-l', groupName: 'ขนาด', name: 'L', priceDelta: { amount: '10.00', currency: 'THB' } },
      { choiceId: 'milk-oat', groupName: 'นม', name: 'นมโอ๊ต', priceDelta: { amount: '15.00', currency: 'THB' } },
    ],
    quantity: 2,
    unitPrice: { amount: '80.00', currency: 'THB' },
    lineTotal: { amount: '160.00', currency: 'THB' },
  }],
  total: { amount: '160.00', currency: 'THB' },
} as CustomerOrder;

describe('OrderStatus', () => {
  it('AC28: แสดงคิว 17 รับออเดอร์แล้ว รายการ และยอด', async () => {
    const api = fakeApi({ getOrder: async () => queue17 });
    render(<OrderStatus api={api} orderId={queue17.id} />);

    expect(await screen.findByText('17')).toBeTruthy();
    expect(screen.getByText('รับออเดอร์แล้ว')).toBeTruthy();
    expect(screen.getByText('ลาเต้')).toBeTruthy();
    expect(screen.getByText('L')).toBeTruthy();
    expect(screen.getByText('นมโอ๊ต')).toBeTruthy();
    expect(screen.getByText('x2')).toBeTruthy();
    expect(screen.getAllByText('160.00').length).toBeGreaterThan(0);
    expect(api.calls.getOrder[0]).toEqual([queue17.id]);
  });
});
