import express, { type Express } from 'express';
import { JsonMenuRepository } from './modules/menu';
import type { MenuLookup } from './modules/ordering/application/ports';
import { PgUnitOfWork } from './modules/ordering/infrastructure/pg-unit-of-work';
import { createOrderingModule } from './modules/ordering/module';
import type { Clock } from './shared/clock';
import type { Pool } from './shared/db';
import { errorHandler } from './shared/http-errors';
import type { IdGenerator } from './shared/ids';

// ประกอบทุก module; ordering ได้ menu ผ่าน port MenuLookup เท่านั้น
export async function createApp({ pool, menuPath, clock, ids }: { pool: Pool; menuPath: string; clock: Clock; ids: IdGenerator }): Promise<Express> {
  const menuRepository = await JsonMenuRepository.load(menuPath);
  const menu: MenuLookup = { findByIds: (menuItemIds) => menuRepository.findByIds(menuItemIds) };
  const ordering = createOrderingModule({ uow: new PgUnitOfWork(pool), menu, clock, ids });

  const app = express();
  app.use(express.json());
  app.use(ordering.router);
  app.use(errorHandler);
  return app;
}
