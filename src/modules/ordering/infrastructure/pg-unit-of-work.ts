import { inTransaction, type Pool } from '../../../shared/db';
import type { OrderingRepositories, UnitOfWork } from '../application/ports';
import { PgCartRepository } from './pg-cart-repository';
import { PgOrderRepository } from './pg-order-repository';
import { PgQueueNumberSequence } from './pg-queue-number-sequence';

export class PgUnitOfWork implements UnitOfWork {
  constructor(private readonly pool: Pool) {}

  run<T>(work: (repos: OrderingRepositories) => Promise<T>): Promise<T> {
    return inTransaction(this.pool, (client) =>
      work({
        carts: new PgCartRepository(client),
        orders: new PgOrderRepository(client),
        queueNumbers: new PgQueueNumberSequence(client),
      }),
    );
  }
}
