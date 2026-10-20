import type { VoiceMenuGroup, VoiceMenuItem } from '../voice-menu';

// ค่าตรงกับ data/menu.json (voice ห้าม import fixture ของ context อื่น)
const size: VoiceMenuGroup = {
  id: 'size',
  name: 'ขนาด',
  required: true,
  choices: [
    { id: 'size-m', name: 'M', priceDeltaSatang: 0 },
    { id: 'size-l', name: 'L', priceDeltaSatang: 1000 },
  ],
};

export const latte: VoiceMenuItem = {
  id: 'latte',
  name: 'ลาเต้',
  basePriceSatang: 5500,
  available: true,
  optionGroups: [
    size,
    { id: 'milk', name: 'นม', required: false, choices: [{ id: 'milk-oat', name: 'นมโอ๊ต', priceDeltaSatang: 1500 }] },
  ],
};

export const matchaSoldOut: VoiceMenuItem = {
  id: 'matcha-latte',
  name: 'มัทฉะลาเต้',
  basePriceSatang: 6500,
  available: false,
  optionGroups: [size],
};

export const menu: VoiceMenuItem[] = [latte, matchaSoldOut];
