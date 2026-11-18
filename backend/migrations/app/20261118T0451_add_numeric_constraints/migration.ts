#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/cf909af09f70a63632d3066c4529562abdb9cd79d40b2fbc5845e42c96bbba84/contract';
import startContract from '../../snapshots/cf909af09f70a63632d3066c4529562abdb9cd79d40b2fbc5845e42c96bbba84/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/f2a16f9174cd2e1457ed97bab6f5cc78b8df29f593e30bd674781ee08fb3dc5f/contract';
import endContract from '../../snapshots/f2a16f9174cd2e1457ed97bab6f5cc78b8df29f593e30bd674781ee08fb3dc5f/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addCheckConstraint({
        schema: 'public',
        table: 'Product',
        constraint: 'product_nonnegative_values_6d80862f',
        expression:
          '"stockQuantity" >= 0 AND "reorderLevel" >= 0 AND "costPrice" >= 0 AND "sellingPrice" >= 0',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'Sale',
        constraint: 'sale_valid_amounts_c0b51f2d',
        expression:
          '"subtotal" >= 0 AND "discount" >= 0 AND "total" >= 0 AND "discount" <= "subtotal"',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'SaleItem',
        constraint: 'sale_item_valid_values_faa17784',
        expression: '"quantity" > 0 AND "unitPrice" >= 0 AND "unitCost" >= 0 AND "lineTotal" >= 0',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'StockMovement',
        constraint: 'stock_movement_valid_quantities_accc3449',
        expression: '"quantity" > 0 AND "quantityAfter" >= 0',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
