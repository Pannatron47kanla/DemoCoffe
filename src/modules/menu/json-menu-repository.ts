import { readFile } from 'node:fs/promises';
import type { MenuItem } from './menu-item';

// เฟส 1 เมนูอยู่ในไฟล์ อ่านใหม่ทุกครั้งเพื่อให้แก้ราคาหรือสถานะหมดได้โดยไม่ต้องรีสตาร์ต
export class JsonMenuRepository {
  private constructor(private readonly path: string) {}

  static async load(path: string): Promise<JsonMenuRepository> {
    const repository = new JsonMenuRepository(path);
    await repository.readAll(); // ให้ไฟล์หายหรือ JSON เสียแจ้งตั้งแต่ตอนเริ่มระบบ
    return repository;
  }

  async findByIds(ids: readonly string[]): Promise<MenuItem[]> {
    return (await this.readAll()).filter((item) => ids.includes(item.id));
  }

  async all(): Promise<MenuItem[]> {
    return this.readAll();
  }

  private async readAll(): Promise<MenuItem[]> {
    const { items } = JSON.parse(await readFile(this.path, 'utf8')) as { items: MenuItem[] };
    return items;
  }
}
