
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { ProductsService } from './products.service.js';
import { DatabaseService } from '../database/database.service.js';

describe('ProductsService', () => {
  let service: ProductsService;

  const productFirst = vi.fn();
  const productAll = vi.fn();
  const productUpdate = vi.fn();
  const productCreate = vi.fn();
  const categoryFirst = vi.fn();

  const mockDatabaseService = {
    db: {
      orm: {
        public: {
          Product: {
            where: vi.fn(() => ({
              first: productFirst,
              all: productAll,
              update: productUpdate,
            })),
            create: productCreate,
          },
          Category: {
            where: vi.fn(() => ({
              first: categoryFirst,
            })),
          },
        },
      },
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a product with trimmed values', async () => {
    productFirst.mockResolvedValueOnce(null);
    categoryFirst.mockResolvedValueOnce({
      id: 1,
      name: 'Accessories',
      isActive: true,
    });

    const createdProduct = {
      id: 10,
      sku: 'SF-1002',
      name: 'USB Keyboard',
      costPrice: '350',
      sellingPrice: '549',
      categoryId: 1,
      isActive: true,
    };

    productCreate.mockResolvedValueOnce(createdProduct);

    const result = await service.create({
      sku: ' SF-1002 ',
      name: ' USB Keyboard ',
      costPrice: 350,
      sellingPrice: 549,
      categoryId: 1,
    });

    expect(productCreate).toHaveBeenCalledWith({
      sku: 'SF-1002',
      name: 'USB Keyboard',
      description: null,
      costPrice: '350',
      sellingPrice: '549',
      categoryId: 1,
    });

    expect(result).toEqual(createdProduct);
  });

  it('should reject a product with a duplicate SKU', async () => {
    productFirst.mockResolvedValueOnce({
      id: 1,
      sku: 'SF-1001',
      name: 'Existing Mouse',
    });

    await expect(
      service.create({
        sku: 'SF-1001',
        name: 'Another Mouse',
        costPrice: 200,
        sellingPrice: 300,
        categoryId: 1,
      }),
    ).rejects.toThrow(ConflictException);

    expect(categoryFirst).not.toHaveBeenCalled();
    expect(productCreate).not.toHaveBeenCalled();
  });

  it('should reject a product with an inactive category', async () => {
    productFirst.mockResolvedValueOnce(null);
    categoryFirst.mockResolvedValueOnce({
      id: 1,
      name: 'Accessories',
      isActive: false,
    });

    await expect(
      service.create({
        sku: 'SF-1003',
        name: 'USB Keyboard',
        costPrice: 350,
        sellingPrice: 549,
        categoryId: 1,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(productCreate).not.toHaveBeenCalled();
  });

  it('should return all products', async () => {
    const products = [
      { id: 1, sku: 'SF-1001', name: 'Wireless Mouse' },
      { id: 2, sku: 'SF-1002', name: 'USB Keyboard' },
    ];

    productAll.mockResolvedValueOnce(products);

    await expect(service.findAll()).resolves.toEqual(products);
  });

  it('should throw when a product does not exist', async () => {
    productFirst.mockResolvedValueOnce(null);

    await expect(service.findOne(999)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should update a product name', async () => {
    productFirst.mockResolvedValueOnce({
      id: 1,
      sku: 'SF-1001',
      name: 'Old Mouse Name',
      isActive: true,
    });

    const updatedProduct = {
      id: 1,
      sku: 'SF-1001',
      name: 'Wireless Mouse',
      isActive: true,
    };

    productUpdate.mockResolvedValueOnce(updatedProduct);

    const result = await service.update(1, {
      name: ' Wireless Mouse ',
    });

    expect(productUpdate).toHaveBeenCalledWith({
      name: 'Wireless Mouse',
    });

    expect(result).toEqual(updatedProduct);
  });

  it('should deactivate an active product', async () => {
    productFirst.mockResolvedValueOnce({
      id: 1,
      sku: 'SF-1001',
      name: 'Wireless Mouse',
      isActive: true,
    });

    productUpdate.mockResolvedValueOnce({
      id: 1,
      isActive: false,
    });

    const result = await service.deactivate(1);

    expect(productUpdate).toHaveBeenCalledWith({
      isActive: false,
    });

    expect(result).toEqual({
      id: 1,
      isActive: false,
    });
  });

  it('should reject deactivating an already inactive product', async () => {
    productFirst.mockResolvedValueOnce({
      id: 1,
      sku: 'SF-1001',
      name: 'Wireless Mouse',
      isActive: false,
    });

    await expect(service.deactivate(1)).rejects.toThrow(
      BadRequestException,
    );

    expect(productUpdate).not.toHaveBeenCalled();
  });
});
