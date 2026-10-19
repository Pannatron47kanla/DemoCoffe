// เมนูในมุมของ ordering: ข้อมูลที่ต้องใช้ตรวจกฎและคิดราคา (ได้มาจาก context menu ผ่าน MenuLookup)
export interface OrderableChoice {
  readonly id: string;
  readonly name: string;
  readonly priceDeltaSatang: number;
}

export interface OrderableOptionGroup {
  readonly id: string;
  readonly name: string;
  readonly required: boolean;
  readonly choices: readonly OrderableChoice[];
}

export interface OrderableItem {
  readonly id: string;
  readonly name: string;
  readonly basePriceSatang: number;
  readonly available: boolean;
  readonly optionGroups: readonly OrderableOptionGroup[];
}
