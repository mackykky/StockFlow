#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/6d90a76200e3083bc8affb1df6c8f4d8f422130fa2defaa5d3789a816c550a8a/contract';
import endContract from '../../snapshots/6d90a76200e3083bc8affb1df6c8f4d8f422130fa2defaa5d3789a816c550a8a/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/a9671c81d9b6c832d2016b37dd5b7a0ab516398c53772e172fef9e47359f97e4/contract';
import startContract from '../../snapshots/a9671c81d9b6c832d2016b37dd5b7a0ab516398c53772e172fef9e47359f97e4/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Product',
        column: col('isSuspended', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
