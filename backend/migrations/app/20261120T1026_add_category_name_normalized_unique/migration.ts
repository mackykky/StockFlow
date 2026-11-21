#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/3282e28709db1d6dfd57ab39216ea69de97ea193cbee2c752961cd823e68be7c/contract';
import endContract from '../../snapshots/3282e28709db1d6dfd57ab39216ea69de97ea193cbee2c752961cd823e68be7c/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/f2a16f9174cd2e1457ed97bab6f5cc78b8df29f593e30bd674781ee08fb3dc5f/contract';
import startContract from '../../snapshots/f2a16f9174cd2e1457ed97bab6f5cc78b8df29f593e30bd674781ee08fb3dc5f/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createIndex({
        schema: 'public',
        table: 'Category',
        index: 'category_name_normalized_unique_1252e4ff',
        expression: sql`lower(btrim(name))`,
        extras: { unique: true },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
