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

    productFirst.mockReset();
    productAll.mockReset();
    productUpdate.mockReset();
    productCreate.mockReset();
    categoryFirst.mockReset();

    productAll.mockResolvedValue([]);

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
    productAll.mockResolvedValueOnce([
      {
        id: 1,
        sku: 'SF-1001',
        name: 'Existing Mouse',
      },
    ]);

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

    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
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

  it('should reject creating a product with a duplicate SKU regardless of case', async () => {
    productAll.mockResolvedValueOnce([
      {
        id: 1,
        sku: 'PROD-001',
        name: 'Existing Product',
      },
    ]);

    await expect(
      service.create({
        sku: 'prod-001',
        name: 'Duplicate Product',
        costPrice: 100,
        sellingPrice: 150,
        categoryId: 1,
      }),
    ).rejects.toThrow(ConflictException);

    expect(categoryFirst).not.toHaveBeenCalled();
    expect(productCreate).not.toHaveBeenCalled();
  });

  it('should reject updating a product to another product SKU regardless of case', async () => {
    productFirst.mockResolvedValueOnce({
      id: 2,
      sku: 'PROD-002',
      name: 'Second Product',
      isActive: true,
    });

    productAll.mockResolvedValueOnce([
      {
        id: 1,
        sku: 'PROD-001',
        name: 'First Product',
      },
      {
        id: 2,
        sku: 'PROD-002',
        name: 'Second Product',
      },
    ]);

    await expect(
      service.update(2, {
        sku: 'prod-001',
      }),
    ).rejects.toThrow(ConflictException);

    expect(productUpdate).not.toHaveBeenCalled();
  });

  it('should allow changing the capitalization of the same product SKU', async () => {
    productFirst.mockResolvedValueOnce({
      id: 1,
      sku: 'PROD-001',
      name: 'Existing Product',
      isActive: true,
    });

    productAll.mockResolvedValueOnce([
      {
        id: 1,
        sku: 'PROD-001',
        name: 'Existing Product',
      },
    ]);

    const updatedProduct = {
      id: 1,
      sku: 'prod-001',
      name: 'Existing Product',
      isActive: true,
    };

    productUpdate.mockResolvedValueOnce(updatedProduct);

    const result = await service.update(1, {
      sku: 'prod-001',
    });

    expect(productUpdate).toHaveBeenCalledWith({
      sku: 'prod-001',
    });

    expect(result).toEqual(updatedProduct);
  });

  it('should allow creating a product with a unique SKU', async () => {
    productAll.mockResolvedValueOnce([
      {
        id: 1,
        sku: 'PROD-001',
        name: 'Existing Product',
      },
    ]);

    categoryFirst.mockResolvedValueOnce({
      id: 1,
      name: 'Accessories',
      isActive: true,
    });

    const createdProduct = {
      id: 2,
      sku: 'PROD-002',
      name: 'New Product',
      costPrice: '100',
      sellingPrice: '150',
      categoryId: 1,
    };

    productCreate.mockResolvedValueOnce(createdProduct);

    const result = await service.create({
      sku: 'PROD-002',
      name: 'New Product',
      costPrice: 100,
      sellingPrice: 150,
      categoryId: 1,
    });

    expect(productCreate).toHaveBeenCalledWith({
      sku: 'PROD-002',
      name: 'New Product',
      description: null,
      costPrice: '100',
      sellingPrice: '150',
      categoryId: 1,
    });

    expect(result).toEqual(createdProduct);
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

    await expect(service.deactivate(1)).rejects.toThrow(BadRequestException);

    expect(productUpdate).not.toHaveBeenCalled();
  });

  it('should return ConflictException when PostgreSQL rejects a duplicate SKU during creation', async () => {
    categoryFirst.mockResolvedValueOnce({
      id: 1,
      name: 'Accessories',
      isActive: true,
    });

    productCreate.mockRejectedValueOnce({
      sqlState: '23505',
      message: 'duplicate key value violates unique constraint',
    });

    await expect(
      service.create({
        sku: 'PROD-001',
        name: 'Duplicate Product',
        costPrice: 100,
        sellingPrice: 150,
        categoryId: 1,
      }),
    ).rejects.toThrow(ConflictException);

    expect(productCreate).toHaveBeenCalledOnce();
  });

  it('should return ConflictException when PostgreSQL rejects a duplicate SKU during update', async () => {
    productFirst.mockResolvedValueOnce({
      id: 2,
      sku: 'PROD-002',
      name: 'Existing Product',
      isActive: true,
    });

    productUpdate.mockRejectedValueOnce({
      sqlState: '23505',
      message: 'duplicate key value violates unique constraint',
    });

    await expect(
      service.update(2, {
        sku: 'PROD-001',
      }),
    ).rejects.toThrow(ConflictException);

    expect(productUpdate).toHaveBeenCalledOnce();
  });
});
