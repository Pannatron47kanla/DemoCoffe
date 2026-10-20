import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { expectMatchesSpec } from '../../../../tests/support/openapi';
import { JsonMenuRepository, menuRoutes } from '..';

type Group = { id: string; required: boolean; choices: { id: string; priceDelta: { amount: string } }[] };
type Item = { id: string; basePrice: unknown; available: boolean; optionGroups: Group[] };

describe('GET /menu', () => {
  it('AC1: GET /menu ตอบทุกเมนูพร้อมราคาบาท ตัวเลือก และมัทฉะลาเต้หมด', async () => {
    const repository = await JsonMenuRepository.load('data/menu.json');
    const app = express().use(menuRoutes(repository));

    const res = await request(app).get('/menu');

    expect(res.status).toBe(200);
    const items = res.body.items as Item[];
    expect(items.map((i) => i.id)).toEqual(['latte', 'americano', 'espresso', 'cocoa', 'matcha-latte']);
    const latte = items.find((i) => i.id === 'latte');
    expect(latte!.basePrice).toEqual({ amount: '55.00', currency: 'THB' });
    const size = latte!.optionGroups.find((g) => g.id === 'size');
    expect(size!.required).toBe(true);
    expect(size!.choices.find((c) => c.id === 'size-l')!.priceDelta.amount).toBe('10.00');
    expect(items.find((i) => i.id === 'matcha-latte')!.available).toBe(false);
    expectMatchesSpec('get', '/menu', res);
  });
});
