import { Router } from 'express';
import { money } from '../../shared/money-json';
import type { MenuItem } from './menu-item';

// GET /menu: เมนูทั้งหมดสำหรับหน้าจอตู้ (รวมรายการที่หมดเพื่อแสดงว่า "หมด")
export function menuRoutes(menu: { all(): Promise<MenuItem[]> }): Router {
  const router = Router();
  router.get('/menu', async (_req, res, next) => {
    try {
      const items = await menu.all();
      res.json({
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          basePrice: money(item.basePriceSatang),
          available: item.available,
          optionGroups: item.optionGroups.map((group) => ({
            id: group.id,
            name: group.name,
            required: group.required,
            choices: group.choices.map((choice) => ({ id: choice.id, name: choice.name, priceDelta: money(choice.priceDeltaSatang) })),
          })),
        })),
      });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
