import type { OrderableItem } from '../orderable-item';

const size = {
  id: 'size',
  name: 'ขนาด',
  required: true,
  choices: [
    { id: 'size-m', name: 'M', priceDeltaSatang: 0 },
    { id: 'size-l', name: 'L', priceDeltaSatang: 1000 },
  ],
};

export const latte: OrderableItem = {
  id: 'latte',
  name: 'ลาเต้',
  basePriceSatang: 5500,
  available: true,
  optionGroups: [
    size,
    { id: 'milk', name: 'นม', required: false, choices: [{ id: 'milk-oat', name: 'นมโอ๊ต', priceDeltaSatang: 1500 }] },
    {
      id: 'sweetness',
      name: 'ความหวาน',
      required: false,
      choices: [
        { id: 'sweet-0', name: 'ไม่หวาน', priceDeltaSatang: 0 },
        { id: 'sweet-50', name: 'หวานน้อย', priceDeltaSatang: 0 },
      ],
    },
  ],
};

export const americano: OrderableItem = {
  id: 'americano',
  name: 'อเมริกาโน่',
  basePriceSatang: 5000,
  available: true,
  optionGroups: [size],
};

export const espresso: OrderableItem = {
  id: 'espresso',
  name: 'เอสเพรสโซ่',
  basePriceSatang: 4500,
  available: true,
  optionGroups: [],
};

export const matchaSoldOut: OrderableItem = {
  id: 'matcha-latte',
  name: 'มัทฉะลาเต้',
  basePriceSatang: 6500,
  available: false,
  optionGroups: [size],
};

export function withPrice(item: OrderableItem, basePriceSatang: number): OrderableItem {
  return { ...item, basePriceSatang };
}

export function soldOut(item: OrderableItem): OrderableItem {
  return { ...item, available: false };
}
