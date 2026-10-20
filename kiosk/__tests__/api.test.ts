import { describe, expect, it } from 'vitest';
import { ApiError, createApi } from '../lib/api';

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return { impl, calls };
}

describe('createApi', () => {
  it('AC7: createApi ส่ง path และ header ตาม spec และโยน ApiError พร้อม body', async () => {
    const ok = fakeFetch(201, { id: 'o1' });
    await createApi('', ok.impl).checkout('c1', 'k1');
    expect(ok.calls[0]?.url).toBe('/carts/c1/checkout');
    expect(ok.calls[0]?.init?.method).toBe('POST');
    expect(new Headers(ok.calls[0]?.init?.headers).get('Idempotency-Key')).toBe('k1');

    const conflict = fakeFetch(409, { code: 'CART_EMPTY', message: 'ตะกร้ายังว่าง' });
    const error = await createApi('', conflict.impl).checkout('c1', 'k1').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).body.code).toBe('CART_EMPTY');

    const notFound = fakeFetch(404, { code: 'X', message: 'm' });
    const result = await createApi('', notFound.impl).callVoiceFunction('s1', { name: 'show_cart', args: {} });
    expect(result).toEqual({ status: 404, body: { code: 'X', message: 'm' } });
  });
});
