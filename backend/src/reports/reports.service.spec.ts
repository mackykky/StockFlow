
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportsService } from './reports.service.js';
import { DatabaseService } from '../database/database.service.js';

describe('ReportsService', () => {
  let service: ReportsService;

  let mockProducts: Array<{
    id: number;
    sku: string;
    name: string;
    isActive: boolean;
    stockQuantity: number;
    reorderLevel: number;
    costPrice: string;
    categoryId: number;
  }>;

  let mockMovements: Array<{
    id: number;
    type: string;
    quantity: number;
    quantityAfter: number;
    productId: number;
    userId: number;
    createdAt: Date;
  }>;

  const mockProductQuery = vi.fn();
  const mockMovementQuery = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();

    mockProducts = [];
    mockMovements = [];

    mockProductQuery.mockImplementation(() => ({
      all: vi.fn().mockImplementation(async () => mockProducts),
    }));

    mockMovementQuery.mockImplementation(() => ({
      all: vi.fn().mockImplementation(async () => mockMovements),
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: DatabaseService,
          useValue: {
            db: {
              orm: {
                public: {
                  Sale: { where: () => ({ all: async () => [
                    { status: 'COMPLETED', total: '10.00', createdAt: '2026-10-01T15:59:59.999Z' },
                    { status: 'COMPLETED', total: '20.00', createdAt: '2026-10-01T16:00:00.000Z' },
                  ] }) },
                  Product: {
                    where: mockProductQuery,
                  },
                  StockMovement: {
                    where: mockMovementQuery,
                  },
                },
              },
            },
          },
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  it('labels sales on either side of Manila midnight with the correct business day', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-10-01T16:00:01Z'));
      const trend = await service.getSalesTrends();
      expect(trend.dailySales.slice(-2)).toEqual([
        { date: '2026-10-01', salesCount: 1, revenue: '10.00' },
        { date: '2026-10-02', salesCount: 1, revenue: '20.00' },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return an empty inventory summary when there are no products', async () => {
    await expect(service.getInventorySummary()).resolves.toEqual({
      totalActiveProducts: 0,
      totalStockUnits: 0,
      sellableStockUnits: 0,
      inventoryCostValue: '0.00',
      lowStockProducts: 0,
      outOfStockProducts: 0,
    });
  });

  it('should count inactive stock as physical stock and exclude it from sellable units', async () => {
    mockProducts = [
      {
        id: 1,
        sku: 'SF-1001',
        name: 'Wireless Mouse',
        isActive: true,
        stockQuantity: 10,
        reorderLevel: 5,
        costPrice: '350.00',
        categoryId: 1,
      },
      {
        id: 2,
        sku: 'SF-1002',
        name: 'Keyboard',
        isActive: true,
        stockQuantity: 4,
        reorderLevel: 5,
        costPrice: '500.00',
        categoryId: 1,
      },
      {
        id: 3,
        sku: 'SF-1003',
        name: 'Inactive Product',
        isActive: false,
        stockQuantity: 100,
        reorderLevel: 10,
        costPrice: '100.00',
        categoryId: 1,
      },
    ];

    await expect(service.getInventorySummary()).resolves.toEqual({
      totalActiveProducts: 2,
      totalStockUnits: 114,
      sellableStockUnits: 14,
      inventoryCostValue: '15500.00',
      lowStockProducts: 1,
      outOfStockProducts: 0,
    });
  });

  it('should count a product at its reorder level as low stock', async () => {
    mockProducts = [
      {
        id: 1,
        sku: 'SF-1001',
        name: 'Wireless Mouse',
        isActive: true,
        stockQuantity: 5,
        reorderLevel: 5,
        costPrice: '350.00',
        categoryId: 1,
      },
    ];

    const result = await service.getLowStockProducts();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 1,
      sku: 'SF-1001',
      stockQuantity: 5,
      reorderLevel: 5,
      shortage: 0,
    });
  });

  it('should include out-of-stock products in the low-stock list', async () => {
    mockProducts = [
      {
        id: 1,
        sku: 'SF-1001',
        name: 'Wireless Mouse',
        isActive: true,
        stockQuantity: 0,
        reorderLevel: 5,
        costPrice: '350.00',
        categoryId: 1,
      },
    ];

    const result = await service.getLowStockProducts();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      stockQuantity: 0,
      reorderLevel: 5,
      shortage: 5,
    });
  });

  it('should exclude inactive products from the low-stock list', async () => {
    mockProducts = [
      {
        id: 1,
        sku: 'SF-1001',
        name: 'Inactive Mouse',
        isActive: false,
        stockQuantity: 0,
        reorderLevel: 5,
        costPrice: '350.00',
        categoryId: 1,
      },
    ];

    await expect(service.getLowStockProducts()).resolves.toEqual([]);
  });

  it('should return no low-stock products when all active products are above reorder level', async () => {
    mockProducts = [
      {
        id: 1,
        sku: 'SF-1001',
        name: 'Wireless Mouse',
        isActive: true,
        stockQuantity: 10,
        reorderLevel: 5,
        costPrice: '350.00',
        categoryId: 1,
      },
    ];

    await expect(service.getLowStockProducts()).resolves.toEqual([]);
  });

  it('should return an empty list when there are no stock movements', async () => {
    await expect(service.getStockMovements()).resolves.toEqual([]);
  });

  it('should return all stock movements with newest first', async () => {
    mockMovements = [
      {
        id: 1,
        type: 'PURCHASE',
        quantity: 10,
        quantityAfter: 10,
        productId: 1,
        userId: 1,
        createdAt: new Date('2026-10-01T10:00:00.000Z'),
      },
      {
        id: 2,
        type: 'ADJUSTMENT_IN',
        quantity: 5,
        quantityAfter: 15,
        productId: 1,
        userId: 1,
        createdAt: new Date('2026-10-03T10:00:00.000Z'),
      },
      {
        id: 3,
        type: 'PURCHASE',
        quantity: 8,
        quantityAfter: 8,
        productId: 2,
        userId: 1,
        createdAt: new Date('2026-10-02T10:00:00.000Z'),
      },
    ];

    const result = await service.getStockMovements();

    expect(result.map((movement) => movement.id)).toEqual([2, 3, 1]);
  });

  it('should filter stock movements by product ID', async () => {
    mockMovements = [
      {
        id: 1,
        type: 'PURCHASE',
        quantity: 10,
        quantityAfter: 10,
        productId: 1,
        userId: 1,
        createdAt: new Date('2026-10-01T10:00:00.000Z'),
      },
      {
        id: 2,
        type: 'PURCHASE',
        quantity: 8,
        quantityAfter: 8,
        productId: 2,
        userId: 1,
        createdAt: new Date('2026-10-02T10:00:00.000Z'),
      },
    ];

    const result = await service.getStockMovements({
      productId: 1,
    });

    expect(result.map((movement) => movement.id)).toEqual([1]);
  });

  it('should filter stock movements by type', async () => {
    mockMovements = [
      {
        id: 1,
        type: 'PURCHASE',
        quantity: 10,
        quantityAfter: 10,
        productId: 1,
        userId: 1,
        createdAt: new Date('2026-10-01T10:00:00.000Z'),
      },
      {
        id: 2,
        type: 'ADJUSTMENT_IN',
        quantity: 5,
        quantityAfter: 15,
        productId: 1,
        userId: 1,
        createdAt: new Date('2026-10-02T10:00:00.000Z'),
      },
    ];

    const result = await service.getStockMovements({
      type: 'PURCHASE',
    });

    expect(result.map((movement) => movement.id)).toEqual([1]);
  });

  it('should filter movements within the requested date range', async () => {
    mockMovements = [
      {
        id: 1,
        type: 'PURCHASE',
        quantity: 10,
        quantityAfter: 10,
        productId: 1,
        userId: 1,
        createdAt: new Date('2026-09-30T15:59:59.999Z'),
      },
      {
        id: 2,
        type: 'PURCHASE',
        quantity: 5,
        quantityAfter: 15,
        productId: 1,
        userId: 1,
        createdAt: new Date('2026-10-05T12:00:00.000Z'),
      },
      {
        id: 3,
        type: 'PURCHASE',
        quantity: 8,
        quantityAfter: 23,
        productId: 1,
        userId: 1,
        createdAt: new Date('2026-10-10T15:59:59.999Z'),
      },
      {
        id: 4,
        type: 'PURCHASE',
        quantity: 3,
        quantityAfter: 26,
        productId: 1,
        userId: 1,
        createdAt: new Date('2026-10-10T16:00:00.000Z'),
      },
    ];

    const result = await service.getStockMovements({
      startDate: '2026-10-01',
      endDate: '2026-10-10',
    });

    expect(result.map((movement) => movement.id)).toEqual([3, 2]);
  });

  it('should combine product and movement type filters', async () => {
    mockMovements = [
      {
        id: 1,
        type: 'PURCHASE',
        quantity: 10,
        quantityAfter: 10,
        productId: 1,
        userId: 1,
        createdAt: new Date('2026-10-01T10:00:00.000Z'),
      },
      {
        id: 2,
        type: 'ADJUSTMENT_IN',
        quantity: 5,
        quantityAfter: 15,
        productId: 1,
        userId: 1,
        createdAt: new Date('2026-10-02T10:00:00.000Z'),
      },
      {
        id: 3,
        type: 'PURCHASE',
        quantity: 8,
        quantityAfter: 8,
        productId: 2,
        userId: 1,
        createdAt: new Date('2026-10-03T10:00:00.000Z'),
      },
    ];

    const result = await service.getStockMovements({
      productId: 1,
      type: 'PURCHASE',
    });

    expect(result.map((movement) => movement.id)).toEqual([1]);
  });
});
