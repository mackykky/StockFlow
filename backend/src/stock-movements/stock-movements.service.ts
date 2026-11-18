
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto.js';

const INBOUND_TYPES = [
  'OPENING_STOCK',
  'PURCHASE',
  'ADJUSTMENT_IN',
  'RETURN_IN',
] as const;

const OUTBOUND_TYPES = [
  'ADJUSTMENT_OUT',
  'RETURN_OUT',
] as const;

@Injectable()
export class StockMovementsService {
  constructor(
    private readonly databaseService: DatabaseService,
  ) {}

async create(dto: CreateStockMovementDto, userId: number) {    const isInbound = (INBOUND_TYPES as readonly string[]).includes(
      dto.type,
    );
    const isOutbound = (OUTBOUND_TYPES as readonly string[]).includes(
      dto.type,
    );

    if ((dto.type as string) === 'SALE') {
  throw new BadRequestException(
    'Sales movements must be created through the Sales API.',
  );
}

    if (!isInbound && !isOutbound) {
      throw new BadRequestException('Unsupported stock movement type.');
    }

    if (
      dto.type === 'OPENING_STOCK' &&
      dto.quantity <= 0
    ) {
      throw new BadRequestException(
        'Opening stock quantity must be greater than zero.',
      );
    }

    const notes = dto.notes?.trim() || null;

    return this.databaseService.db.transaction(async (tx) => {
      const product = await tx.orm.public.Product
        .where({ id: dto.productId })
        .forUpdate()
        .first();

      if (!product) {
        throw new NotFoundException(
          `Product with ID ${dto.productId} was not found.`,
        );
      }

      if (!product.isActive) {
        throw new BadRequestException(
          'Cannot change stock for an inactive product.',
        );
      }

      const user = await tx.orm.public.User
  .where({ id: userId })
  .first();

      if (!user || !user.isActive) {
        throw new BadRequestException(
          'The specified user does not exist or is inactive.',
        );
      }

      if (
        dto.type === 'OPENING_STOCK' &&
        product.stockQuantity !== 0
      ) {
        throw new BadRequestException(
          'Opening stock can only be recorded when current stock is zero.',
        );
      }

      const quantityAfter = isInbound
        ? product.stockQuantity + dto.quantity
        : product.stockQuantity - dto.quantity;

      if (quantityAfter < 0) {
        throw new BadRequestException(
          `Insufficient stock. Available: ${product.stockQuantity}; requested: ${dto.quantity}.`,
        );
      }

      await tx.orm.public.Product
        .where({ id: product.id })
        .update({ stockQuantity: quantityAfter });

      const movement = await tx.orm.public.StockMovement.create({
        type: dto.type,
        quantity: dto.quantity,
        quantityAfter,
        notes,
        productId: product.id,
        userId: user.id,
      });

      return {
        message: 'Stock movement recorded successfully.',
        movement,
        stock: {
          productId: product.id,
          productName: product.name,
          previousQuantity: product.stockQuantity,
          movementQuantity: dto.quantity,
          quantityAfter,
        },
      };
    });
  }

      async findAll() {
    const movements = await this.databaseService.db.orm.public.StockMovement
      .where({})
      .all();

    return [...movements].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime(),
    );
  }

  async findByProduct(productId: number) {
    const product = await this.databaseService.db.orm.public.Product
      .where({ id: productId })
      .first();

    if (!product) {
      throw new NotFoundException(
        `Product with ID ${productId} was not found.`,
      );
    }

    const movements = await this.databaseService.db.orm.public.StockMovement
      .where({ productId })
      .all();

    return [...movements].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime(),
    );
  }
}
