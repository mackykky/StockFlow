#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/3282e28709db1d6dfd57ab39216ea69de97ea193cbee2c752961cd823e68be7c/contract';
import startContract from '../../snapshots/3282e28709db1d6dfd57ab39216ea69de97ea193cbee2c752961cd823e68be7c/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/a9671c81d9b6c832d2016b37dd5b7a0ab516398c53772e172fef9e47359f97e4/contract';
import endContract from '../../snapshots/a9671c81d9b6c832d2016b37dd5b7a0ab516398c53772e172fef9e47359f97e4/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createIndex({
        schema: 'public',
        table: 'Product',
        index: 'product_sku_normalized_unique_3047adec',
        expression: sql`lower(btrim(sku))`,
        extras: { unique: true },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
