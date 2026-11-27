import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { ReportsService } from './reports.service.js';
import { STOCK_MOVEMENT_TYPES } from '../stock-movements/dto/create-stock-movement.dto.js';
import type { StockMovementTypeInput } from '../stock-movements/dto/create-stock-movement.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles/roles.guard.js';
import type { Response } from 'express';
import { toCsv } from '../common/utils/csv.util.js';
import { Roles } from '../auth/decorators/roles/roles.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Roles('ADMIN', 'MANAGER')
  @Get('inventory-summary')
  getInventorySummary() {
    return this.reportsService.getInventorySummary();
  }

  @Roles('ADMIN', 'MANAGER')
  @Get('dashboard')
  getDashboard() {
    return this.reportsService.getDashboard();
  }
  @Roles('ADMIN', 'MANAGER')
  @Get('inventory-summary/export')
  async exportInventorySummary(@Res() response: Response) {
    const products = await this.reportsService.getInventorySummaryProducts();

    const csv = toCsv(
      [
        'SKU',
        'Product Name',
        'Category',
        'Physical Stock Quantity',
        'Sellable Quantity',
        'Cost Price',
        'Inventory Cost Value',
      ],
      products.map((product) => [
        product.sku,
        product.name,
        product.categoryName,
        product.stockQuantity,
        product.sellableQuantity,
        product.costPrice,
        (Number(product.costPrice) * product.stockQuantity).toFixed(2),
      ]),
    );
    response
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header(
        'Content-Disposition',
        'attachment; filename="stockflow-inventory-summary.csv"',
      )
      .send('\uFEFF' + csv);
  }

  @Get('low-stock')
  getLowStockProducts() {
    return this.reportsService.getLowStockProducts();
  }

  @Get('stock-movements')
  getStockMovements(
    @Query('productId') productId?: string,
    @Query('type') type?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters = this.validateStockMovementFilters(
      productId,
      type,
      startDate,
      endDate,
    );

    return this.reportsService.getStockMovements(filters);
  }

  @Get('stock-movements/export')
  async exportStockMovements(
    @Query('productId') productId?: string,
    @Query('type') type?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Res() response?: Response,
  ) {
    const filters = this.validateStockMovementFilters(
      productId,
      type,
      startDate,
      endDate,
    );

    const movements = await this.reportsService.getStockMovements(filters);

    const csv = toCsv(
      [
        'Product SKU',
        'Product Name',
        'Movement Type',
        'Quantity',
        'Quantity After',
        'Notes',
        'Date & Time',
      ],
      movements.map((movement) => [
        movement.product.sku,
        movement.product.name,
        movement.type,
        movement.quantity,
        movement.quantityAfter,
        movement.notes,
        movement.createdAt,
      ]),
    );
    response!
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header(
        'Content-Disposition',
        'attachment; filename="stockflow-stock-movements.csv"',
      )
      .send('\uFEFF' + csv);
  }

  private validateStockMovementFilters(
    productId?: string,
    type?: string,
    startDate?: string,
    endDate?: string,
  ) {
    let parsedProductId: number | undefined;

    if (productId !== undefined) {
      parsedProductId = Number(productId);

      if (!Number.isInteger(parsedProductId) || parsedProductId < 1) {
        throw new BadRequestException('productId must be a positive integer.');
      }
    }

    if (
      type !== undefined &&
      type !== 'SALE' &&
      !STOCK_MOVEMENT_TYPES.includes(type as StockMovementTypeInput)
    ) {
      throw new BadRequestException('Invalid stock movement type.');
    }

    if (
      startDate !== undefined &&
      (Number.isNaN(Date.parse(startDate)) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || new Date(startDate).toISOString().slice(0, 10) !== startDate)
    ) {
      throw new BadRequestException('startDate must use YYYY-MM-DD format.');
    }

    if (
      endDate !== undefined &&
      (Number.isNaN(Date.parse(endDate)) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || new Date(endDate).toISOString().slice(0, 10) !== endDate)
    ) {
      throw new BadRequestException('endDate must use YYYY-MM-DD format.');
    }

    if (
      startDate !== undefined &&
      endDate !== undefined &&
      startDate > endDate
    ) {
      throw new BadRequestException('startDate cannot be later than endDate.');
    }

    return {
      productId: parsedProductId,
      type: type as StockMovementTypeInput | 'SALE' | undefined,
      startDate,
      endDate,
    };
  }
}
