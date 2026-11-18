import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service.js';
import { CreateSaleDto } from './dto/create-sale.dto.js';

function parseMoneyToCents(value: unknown): bigint {
  const text = String(value);

  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
    throw new BadRequestException('Invalid monetary value.');
  }

  const [whole, fraction = ''] = text.split('.');

  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

function formatCents(cents: bigint): string {
  const whole = cents / 100n;
  const fraction = (cents % 100n).toString().padStart(2, '0');

  return `${whole}.${fraction}`;
}

@Injectable()
export class SalesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(dto: CreateSaleDto, userId: number) {
    const notes = dto.notes?.trim() || null;

    const productIds = dto.items.map((item) => item.productId);

    const itemsForProcessing = [...dto.items].sort(
      (a, b) => a.productId - b.productId,
    );

    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException(
        'Each product can appear only once in a sale.',
      );
    }

    return this.databaseService.db.transaction(async (tx) => {
      const user = await tx.orm.public.User.where({ id: userId }).first();

      if (!user || !user.isActive) {
        throw new BadRequestException(
          'The specified user does not exist or is inactive.',
        );
      }

      let subtotalCents = 0n;
      const saleItems: Array<{
        productId: number;
        quantity: number;
        unitPrice: string;
        unitCost: string;
        lineTotal: string;
      }> = [];

      for (const item of itemsForProcessing) {
        const product = await tx.orm.public.Product.where({
          id: item.productId,
        })
          .forUpdate()
          .first();

        if (!product) {
          throw new NotFoundException(
            `Product with ID ${item.productId} was not found.`,
          );
        }

        if (!product.isActive) {
          throw new BadRequestException(`Product ${product.sku} is inactive.`);
        }

        if (product.stockQuantity < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for ${product.sku}. Available: ${product.stockQuantity}; requested: ${item.quantity}.`,
          );
        }

        if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) {
          throw new BadRequestException('Invalid sale quantity.');
        }

        let unitPriceCents: bigint;
        let unitCostCents: bigint;

        try {
          unitPriceCents = parseMoneyToCents(product.sellingPrice);
          unitCostCents = parseMoneyToCents(product.costPrice);
        } catch {
          throw new BadRequestException(
            `Product ${product.sku} has an invalid price.`,
          );
        }

        const lineTotalCents = unitPriceCents * BigInt(item.quantity);

        subtotalCents += lineTotalCents;

        saleItems.push({
          productId: product.id,
          quantity: item.quantity,
          unitPrice: formatCents(unitPriceCents),
          unitCost: formatCents(unitCostCents),
          lineTotal: formatCents(lineTotalCents),
        });
      }

      const saleNumber = `SF-${Date.now()}-${randomUUID()
        .slice(0, 8)
        .toUpperCase()}`;

      const sale = await tx.orm.public.Sale.create({
        saleNumber,
        status: 'COMPLETED',
        subtotal: formatCents(subtotalCents),
        discount: '0.00',
        total: formatCents(subtotalCents),
        notes,
        soldById: user.id,
      });

      for (const item of saleItems) {
        const product = await tx.orm.public.Product.where({
          id: item.productId,
        }).first();

        if (!product) {
          throw new NotFoundException(
            `Product with ID ${item.productId} was not found.`,
          );
        }

        if (product.stockQuantity < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for ${product.sku}. Available: ${product.stockQuantity}; requested: ${item.quantity}.`,
          );
        }

        const quantityAfter = product.stockQuantity - item.quantity;

        await tx.orm.public.Product.where({ id: product.id }).update({
          stockQuantity: quantityAfter,
        });

        await tx.orm.public.SaleItem.create({
          saleId: sale.id,
          productId: product.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitCost: item.unitCost,
          lineTotal: item.lineTotal,
        });

        await tx.orm.public.StockMovement.create({
          type: 'SALE',
          quantity: item.quantity,
          quantityAfter,
          notes: `Sale ${saleNumber}`,
          productId: product.id,
          userId: user.id,
        });
      }

      return {
        message: 'Sale completed successfully.',
        sale: {
          ...sale,
          items: saleItems,
        },
      };
    });
  }

  async findAll() {
    return this.databaseService.db.orm.public.Sale.where({}).all();
  }

  async findById(id: number) {
    const sale = await this.databaseService.db.orm.public.Sale.where({
      id,
    }).first();

    if (!sale) {
      throw new NotFoundException(`Sale with ID ${id} was not found.`);
    }

    const items = await this.databaseService.db.orm.public.SaleItem.where({
      saleId: id,
    }).all();

    return {
      ...sale,
      items,
    };
  }
}
