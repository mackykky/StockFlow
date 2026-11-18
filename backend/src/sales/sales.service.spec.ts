import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { SalesService } from './sales.service.js';
import { DatabaseService } from '../database/database.service.js';
import type { CreateSaleDto } from './dto/create-sale.dto.js';

describe('SalesService', () => {
  let service: SalesService;
  let lockedProductIds: number[] = [];

  const user = {
    id: 7,
    email: 'staff.test@stockflow.local',
    isActive: true,
  };

  const product = {
    id: 1,
    sku: 'SF-1001',
    isActive: true,
    stockQuantity: 10,
    sellingPrice: '549.00',
    costPrice: '350.00',
  };

  const mocks = {
    userFirst: vi.fn(),
    productFirst: vi.fn(),
    productUpdate: vi.fn(),
    saleCreate: vi.fn(),
    saleItemCreate: vi.fn(),
    stockMovementCreate: vi.fn(),
    transaction: vi.fn(),
    productWhere: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    lockedProductIds = [];

    mocks.userFirst.mockResolvedValue(user);
    mocks.productFirst.mockResolvedValue(product);
    mocks.productUpdate.mockResolvedValue(undefined);
    mocks.saleCreate.mockResolvedValue({
      id: 20,
      saleNumber: 'SF-TEST-001',
    });
    mocks.saleItemCreate.mockResolvedValue(undefined);
    mocks.stockMovementCreate.mockResolvedValue(undefined);

    mocks.productFirst.mockImplementation(async (id: number) => ({
      ...product,
      id,
    }));

    mocks.productWhere.mockImplementation((filter: { id: number }) => ({
      forUpdate: () => ({
        first: async () => {
          lockedProductIds.push(filter.id);
          return mocks.productFirst(filter.id);
        },
      }),
      first: () => mocks.productFirst(filter.id),
      update: mocks.productUpdate,
    }));

    const transactionClient = {
      orm: {
        public: {
          User: {
            where: vi.fn(() => ({
              first: mocks.userFirst,
            })),
          },
          Product: {
            where: mocks.productWhere,
          },
          Sale: {
            create: mocks.saleCreate,
          },
          SaleItem: {
            create: mocks.saleItemCreate,
          },
          StockMovement: {
            create: mocks.stockMovementCreate,
          },
        },
      },
    };

    mocks.transaction.mockImplementation(
      async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        {
          provide: DatabaseService,
          useValue: {
            db: {
              transaction: mocks.transaction,
            },
          },
        },
      ],
    }).compile();

    service = module.get<SalesService>(SalesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a sale using the authenticated user ID', async () => {
    const dto: CreateSaleDto = {
      items: [{ productId: 1, quantity: 2 }],
      notes: 'Customer purchase',
    };

    await service.create(dto, 7);

    expect(mocks.saleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        soldById: 7,
        subtotal: '1098.00',
        total: '1098.00',
      }),
    );

    expect(mocks.stockMovementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SALE',
        productId: 1,
        userId: 7,
        quantity: 2,
        quantityAfter: 8,
      }),
    );
  });

  it('should create a sale item with the product prices', async () => {
    const dto: CreateSaleDto = {
      items: [{ productId: 1, quantity: 2 }],
    };

    await service.create(dto, 7);

    expect(mocks.saleItemCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        saleId: 20,
        productId: 1,
        quantity: 2,
        unitPrice: '549.00',
        unitCost: '350.00',
        lineTotal: '1098.00',
      }),
    );
  });

  it('should update the product stock after a sale', async () => {
    const dto: CreateSaleDto = {
      items: [{ productId: 1, quantity: 2 }],
    };

    await service.create(dto, 7);

    expect(mocks.productUpdate).toHaveBeenCalledWith({
      stockQuantity: 8,
    });
  });

  it('should reject a nonexistent or inactive user', async () => {
    mocks.userFirst.mockResolvedValue({
      ...user,
      isActive: false,
    });

    const dto: CreateSaleDto = {
      items: [{ productId: 1, quantity: 1 }],
    };

    await expect(service.create(dto, 7)).rejects.toThrow(BadRequestException);

    expect(mocks.saleCreate).not.toHaveBeenCalled();
  });

  it('should reject duplicate products in a sale', async () => {
    const dto: CreateSaleDto = {
      items: [
        { productId: 1, quantity: 1 },
        { productId: 1, quantity: 2 },
      ],
    };

    await expect(service.create(dto, 7)).rejects.toThrow(
      'Each product can appear only once in a sale.',
    );

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('should reject a sale when stock is insufficient', async () => {
    mocks.productFirst.mockResolvedValue({
      ...product,
      stockQuantity: 1,
    });

    const dto: CreateSaleDto = {
      items: [{ productId: 1, quantity: 2 }],
    };

    await expect(service.create(dto, 7)).rejects.toThrow('Insufficient stock');

    expect(mocks.saleCreate).not.toHaveBeenCalled();
    expect(mocks.productUpdate).not.toHaveBeenCalled();
    expect(mocks.stockMovementCreate).not.toHaveBeenCalled();
  });

  it('should lock products in ascending product ID order', async () => {
    mocks.productFirst.mockImplementation(async (id: number) => ({
      ...product,
      id,
      stockQuantity: 10,
    }));

    const dto: CreateSaleDto = {
      items: [
        { productId: 2, quantity: 1 },
        { productId: 1, quantity: 1 },
      ],
    };

    await service.create(dto, 7);

    expect(lockedProductIds).toEqual([1, 2]);
  });

  it('should calculate decimal prices without floating-point errors', async () => {
    mocks.productFirst.mockImplementation(async (id: number) => ({
      ...product,
      id,
      sellingPrice: '0.10',
      costPrice: '0.05',
      stockQuantity: 10,
    }));

    const dto: CreateSaleDto = {
      items: [{ productId: 1, quantity: 3 }],
    };

    await service.create(dto, 7);

    expect(mocks.saleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        subtotal: '0.30',
        total: '0.30',
      }),
    );

    expect(mocks.saleItemCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        unitPrice: '0.10',
        unitCost: '0.05',
        lineTotal: '0.30',
      }),
    );
  });

  it('should reject database prices with more than two decimal places', async () => {
    mocks.productFirst.mockImplementation(async (id: number) => ({
      ...product,
      id,
      sellingPrice: '10.999',
    }));

    const dto: CreateSaleDto = {
      items: [{ productId: 1, quantity: 1 }],
    };

    await expect(service.create(dto, 7)).rejects.toThrow(
      'Product SF-1001 has an invalid price.',
    );

    expect(mocks.saleCreate).not.toHaveBeenCalled();
  });

  it('should calculate large quantities using exact integer cents', async () => {
    mocks.productFirst.mockImplementation(async (id: number) => ({
      ...product,
      id,
      sellingPrice: '0.01',
      stockQuantity: 200_000_000,
    }));

    const dto: CreateSaleDto = {
      items: [{ productId: 1, quantity: 100_000_000 }],
    };

    await service.create(dto, 7);

    expect(mocks.saleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        subtotal: '1000000.00',
        total: '1000000.00',
      }),
    );
  });
});
