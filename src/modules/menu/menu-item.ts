// menu เป็น context ระดับ crud: ข้อมูลล้วน ไม่มีกฎ (กฎการสั่งอยู่ใน ordering)
export interface OptionChoice {
  id: string;
  name: string;
  priceDeltaSatang: number;
}

export interface OptionGroup {
  id: string;
  name: string;
  required: boolean;
  choices: OptionChoice[];
}

export interface MenuItem {
  id: string;
  name: string;
  basePriceSatang: number;
  available: boolean;
  optionGroups: OptionGroup[];
}
