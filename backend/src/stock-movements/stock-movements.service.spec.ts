
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { StockMovementsService } from './stock-movements.service.js';
import { DatabaseService } from '../database/database.service.js';

describe('StockMovementsService', () => {
  let service: StockMovementsService;

  const productFirst = vi.fn();
  const productUpdate = vi.fn();
  const userFirst = vi.fn();
  const movementCreate = vi.fn();
  const movementAll = vi.fn();

  const productWhere = vi.fn(() => ({
    forUpdate: vi.fn(() => ({
      first: productFirst,
    })),
    first: productFirst,
    update: productUpdate,
  }));

  const userWhere = vi.fn(() => ({
    first: userFirst,
  }));

  const movementWhere = vi.fn(() => ({
    all: movementAll,
  }));

  const tx = {
    orm: {
      public: {
        Product: {
          where: productWhere,
        },
        User: {
          where: userWhere,
        },
        StockMovement: {
          create: movementCreate,
          where: movementWhere,
        },
      },
    },
  };

  const mockDatabaseService = {
    db: {
      transaction: vi.fn(async (callback) => callback(tx)),
      orm: {
        public: {
          Product: {
            where: vi.fn(() => ({
              first: productFirst,
            })),
          },
          StockMovement: {
            where: movementWhere,
          },
        },
      },
    },
  };

  const activeProduct = {
    id: 1,
    name: 'Wireless Mouse',
    stockQuantity: 20,
    isActive: true,
  };

  const activeUser = {
    id: 2,
    isActive: true,
  };


beforeEach(async () => {
  vi.clearAllMocks();

  // Clear queued one-time results from previous tests.
  productFirst.mockReset();
  productUpdate.mockReset();
  userFirst.mockReset();
  movementCreate.mockReset();
  movementAll.mockReset();

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      StockMovementsService,
      {
        provide: DatabaseService,
        useValue: mockDatabaseService,
      },
    ],
  }).compile();

  service = module.get<StockMovementsService>(
    StockMovementsService,
  );
});

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should record an inbound purchase and increase stock', async () => {
    productFirst.mockResolvedValueOnce(activeProduct);
    userFirst.mockResolvedValueOnce(activeUser);

    const movement = {
      id: 1,
      type: 'PURCHASE',
      quantity: 5,
      quantityAfter: 25,
      productId: 1,
      userId: 2,
    };

    movementCreate.mockResolvedValueOnce(movement);

   const result = await service.create(
  {
    type: 'PURCHASE',
    quantity: 5,
    productId: 1,
    notes: '  Restock order  ',
  },
  2,
);
    expect(productUpdate).toHaveBeenCalledWith({
      stockQuantity: 25,
    });

    expect(movementCreate).toHaveBeenCalledWith({
      type: 'PURCHASE',
      quantity: 5,
      quantityAfter: 25,
      notes: 'Restock order',
      productId: 1,
      userId: 2,
    });

    expect(result.stock).toEqual({
      productId: 1,
      productName: 'Wireless Mouse',
      previousQuantity: 20,
      movementQuantity: 5,
      quantityAfter: 25,
    });

    expect(mockDatabaseService.db.transaction).toHaveBeenCalledOnce();
  });


it('should record an outbound adjustment and decrease stock', async () => {
  productFirst.mockResolvedValueOnce(activeProduct);
  userFirst.mockResolvedValueOnce(activeUser);

  movementCreate.mockResolvedValueOnce({
    id: 2,
    type: 'ADJUSTMENT_OUT',
    quantity: 3,
    quantityAfter: 17,
    productId: 1,
    userId: 2,
  });

  const result = await service.create(
    {
      type: 'ADJUSTMENT_OUT',
      quantity: 3,
      productId: 1,
      notes: 'Damaged stock',
    },
    2,
  );

  expect(productUpdate).toHaveBeenCalledWith({
    stockQuantity: 17,
  });
  expect(result.stock.quantityAfter).toBe(17);
  expect(result.stock.previousQuantity).toBe(20);
});



it('should reject an unsupported movement type', async () => {
  await expect(
    service.create(
      {
        type: 'INVALID_TYPE',
        quantity: 5,
        productId: 1,
      } as never,
      2,
    ),
  ).rejects.toThrow(BadRequestException);

  expect(mockDatabaseService.db.transaction).not.toHaveBeenCalled();
});


it('should reject opening stock with a zero quantity', async () => {
  await expect(
    service.create(
      {
        type: 'OPENING_STOCK',
        quantity: 0,
        productId: 1,
      },
      2,
    ),
  ).rejects.toThrow(BadRequestException);

  expect(mockDatabaseService.db.transaction).not.toHaveBeenCalled();
});



it('should reject a product that does not exist', async () => {
  productFirst.mockResolvedValueOnce(null);

  await expect(
    service.create(
      {
        type: 'PURCHASE',
        quantity: 5,
        productId: 999,
      },
      2,
    ),
  ).rejects.toThrow(NotFoundException);

  expect(productUpdate).not.toHaveBeenCalled();
  expect(movementCreate).not.toHaveBeenCalled();
});



it('should reject stock changes for an inactive product', async () => {
  productFirst.mockResolvedValueOnce({
    ...activeProduct,
    isActive: false,
  });
  userFirst.mockResolvedValueOnce(activeUser);

  await expect(
    service.create(
      {
        type: 'PURCHASE',
        quantity: 5,
        productId: 1,
      },
      2,
    ),
  ).rejects.toThrow(BadRequestException);

  expect(productUpdate).not.toHaveBeenCalled();
  expect(movementCreate).not.toHaveBeenCalled();
});



it('should reject an inactive user', async () => {
  productFirst.mockResolvedValueOnce(activeProduct);
  userFirst.mockResolvedValueOnce({
    ...activeUser,
    isActive: false,
  });

  await expect(
    service.create(
      {
        type: 'PURCHASE',
        quantity: 5,
        productId: 1,
      },
      2,
    ),
  ).rejects.toThrow(BadRequestException);

  expect(productUpdate).not.toHaveBeenCalled();
  expect(movementCreate).not.toHaveBeenCalled();
});



it('should reject an outbound movement exceeding available stock', async () => {
  productFirst.mockResolvedValueOnce(activeProduct);
  userFirst.mockResolvedValueOnce(activeUser);

  await expect(
    service.create(
      {
        type: 'ADJUSTMENT_OUT',
        quantity: 21,
        productId: 1,
      },
      2,
    ),
  ).rejects.toThrow(
    'Insufficient stock. Available: 20; requested: 21.',
  );

  expect(productUpdate).not.toHaveBeenCalled();
  expect(movementCreate).not.toHaveBeenCalled();
});



it('should only allow opening stock when current stock is zero', async () => {
  productFirst.mockResolvedValueOnce(activeProduct);
  userFirst.mockResolvedValueOnce(activeUser);

  await expect(
    service.create(
      {
        type: 'OPENING_STOCK',
        quantity: 5,
        productId: 1,
      },
      2,
    ),
  ).rejects.toThrow(BadRequestException);

  expect(productUpdate).not.toHaveBeenCalled();
  expect(movementCreate).not.toHaveBeenCalled();
});


  it('should return all stock movements', async () => {
    const movements = [
      { id: 1, type: 'PURCHASE', quantity: 5 },
      { id: 2, type: 'SALE', quantity: 2 },
    ];

    movementAll.mockResolvedValueOnce(movements);

    await expect(service.findAll()).resolves.toEqual(movements);
  });

  it('should return stock movements for an existing product', async () => {
    productFirst.mockResolvedValueOnce(activeProduct);

    const movements = [
      { id: 1, productId: 1, type: 'PURCHASE', quantity: 5 },
    ];

    movementAll.mockResolvedValueOnce(movements);

    await expect(service.findByProduct(1)).resolves.toEqual(movements);
  });

  it('should throw when finding movements for a nonexistent product', async () => {
    productFirst.mockResolvedValueOnce(null);

    await expect(service.findByProduct(999)).rejects.toThrow(
      NotFoundException,
    );
  });
});
