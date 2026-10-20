'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { OrderStatus } from '../../components/OrderStatus';
import { createApi } from '../../lib/api';

const api = createApi();

function StatusFromUrl() {
  const orderId = useSearchParams().get('order');
  return <OrderStatus api={api} orderId={orderId} />;
}

export default function OrderStatusPage() {
  return (
    <Suspense fallback={null}>
      <StatusFromUrl />
    </Suspense>
  );
}
