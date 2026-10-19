import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonMenuRepository } from '../json-menu-repository';

const MENU_FILE = join(import.meta.dirname, '../../../../data/menu.json');

async function menuFile(content: unknown): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'menu-'));
  const path = join(dir, 'menu.json');
  await writeFile(path, JSON.stringify(content));
  return path;
}

describe('JsonMenuRepository', () => {
  it('AC2: อ่านเมนู ราคา และกลุ่มตัวเลือกจาก data/menu.json', async () => {
    const menu = await JsonMenuRepository.load(MENU_FILE);

    const [latte] = await menu.findByIds(['latte']);

    expect(latte).toMatchObject({ id: 'latte', name: 'ลาเต้', basePriceSatang: 5500, available: true });
    expect(latte?.optionGroups.find((g) => g.id === 'size')).toMatchObject({ required: true });
    expect(latte?.optionGroups.flatMap((g) => g.choices).find((c) => c.id === 'milk-oat')?.priceDeltaSatang).toBe(1500);
  });

  it('AC7: id ที่ไม่มีในเมนูไม่อยู่ในผลลัพธ์', async () => {
    const menu = await JsonMenuRepository.load(MENU_FILE);

    const items = await menu.findByIds(['latte', 'unicorn-frappe']);

    expect(items.map((i) => i.id)).toEqual(['latte']);
  });

  it('AC8: เมนูที่ตั้งเป็นหมดคืน available = false', async () => {
    const menu = await JsonMenuRepository.load(MENU_FILE);

    const [matcha] = await menu.findByIds(['matcha-latte']);

    expect(matcha?.available).toBe(false);
  });

  it('AC22: อ่านไฟล์ใหม่ทุกครั้ง แก้ราคาในไฟล์แล้วเห็นราคาใหม่โดยไม่ต้องรีสตาร์ต', async () => {
    const path = await menuFile({ items: [{ id: 'latte', name: 'ลาเต้', basePriceSatang: 5500, available: true, optionGroups: [] }] });
    const menu = await JsonMenuRepository.load(path);

    await writeFile(path, JSON.stringify({ items: [{ id: 'latte', name: 'ลาเต้', basePriceSatang: 6000, available: true, optionGroups: [] }] }));
    const [latte] = await menu.findByIds(['latte']);

    expect(latte?.basePriceSatang).toBe(6000);
  });
});
