import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { CategoriesService } from './categories.service.js';
import { DatabaseService } from '../database/database.service.js';

describe('CategoriesService', () => {
  let service: CategoriesService;

  const categoryFirst = vi.fn();
  const categoryAll = vi.fn();
  const categoryCreate = vi.fn();
  const categoryUpdate = vi.fn();

  const mockDatabaseService = {
    db: {
      orm: {
        public: {
          Category: {
            where: vi.fn(() => ({
              first: categoryFirst,
              all: categoryAll,
              update: categoryUpdate,
            })),
            create: categoryCreate,
          },
        },
      },
    },
  };

  beforeEach(async () => {
    vi.resetAllMocks();

    mockDatabaseService.db.orm.public.Category.where.mockImplementation(() => ({
      first: categoryFirst,
      all: categoryAll,
      update: categoryUpdate,
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a category with trimmed values', async () => {
    categoryAll.mockResolvedValueOnce([]);

    const createdCategory = {
      id: 1,
      name: 'Accessories',
      description: 'Computer accessories',
      isActive: true,
    };

    categoryCreate.mockResolvedValueOnce(createdCategory);

    const result = await service.create({
      name: ' Accessories ',
      description: ' Computer accessories ',
    });

    expect(categoryCreate).toHaveBeenCalledWith({
      name: 'Accessories',
      description: 'Computer accessories',
    });

    expect(result).toEqual(createdCategory);
  });

  it('should reject a duplicate category name', async () => {
    categoryAll.mockResolvedValueOnce([
      {
        id: 1,
        name: 'Accessories',
      },
    ]);

    await expect(service.create({ name: 'Accessories' })).rejects.toThrow(
      ConflictException,
    );

    expect(categoryCreate).not.toHaveBeenCalled();
  });

  it('should reject an empty category name', async () => {
    await expect(service.create({ name: '   ' })).rejects.toThrow(
      ConflictException,
    );

    expect(categoryCreate).not.toHaveBeenCalled();
  });

  it('should return all categories', async () => {
    const categories = [
      { id: 1, name: 'Accessories', isActive: true },
      { id: 2, name: 'Peripherals', isActive: true },
    ];

    categoryAll.mockResolvedValueOnce(categories);

    await expect(service.findAll()).resolves.toEqual(categories);
  });

  it('should return a category by ID', async () => {
    const category = {
      id: 1,
      name: 'Accessories',
      isActive: true,
    };

    categoryFirst.mockResolvedValueOnce(category);

    await expect(service.findOne(1)).resolves.toEqual(category);
  });

  it('should throw when a category does not exist', async () => {
    categoryFirst.mockResolvedValueOnce(null);

    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('should update a category name', async () => {
    categoryFirst.mockResolvedValueOnce({
      id: 1,
      name: 'Old Name',
      isActive: true,
    });
    categoryAll.mockResolvedValueOnce([]);

    const updatedCategory = {
      id: 1,
      name: 'Accessories',
      isActive: true,
    };

    categoryUpdate.mockResolvedValueOnce(updatedCategory);

    const result = await service.update(1, {
      name: ' Accessories ',
    });

    expect(categoryUpdate).toHaveBeenCalledWith({
      name: 'Accessories',
    });

    expect(result).toEqual(updatedCategory);
  });

  it('should reject updating a category to a duplicate name', async () => {
    categoryFirst.mockResolvedValueOnce({
      id: 1,
      name: 'Old Name',
      isActive: true,
    });

    categoryAll.mockResolvedValueOnce([
      {
        id: 1,
        name: 'Old Name',
        isActive: true,
      },
      {
        id: 2,
        name: 'Accessories',
        isActive: true,
      },
    ]);

    await expect(service.update(1, { name: 'Accessories' })).rejects.toThrow(
      ConflictException,
    );

    expect(categoryUpdate).not.toHaveBeenCalled();
  });

  it('should deactivate an active category', async () => {
    categoryFirst.mockResolvedValueOnce({
      id: 1,
      name: 'Accessories',
      isActive: true,
    });

    const deactivatedCategory = {
      id: 1,
      name: 'Accessories',
      isActive: false,
    };

    categoryUpdate.mockResolvedValueOnce(deactivatedCategory);

    const result = await service.deactivate(1);

    expect(categoryUpdate).toHaveBeenCalledWith({
      isActive: false,
    });

    expect(result).toEqual(deactivatedCategory);
  });

  it('should reject deactivating an already inactive category', async () => {
    categoryFirst.mockResolvedValueOnce({
      id: 1,
      name: 'Accessories',
      isActive: false,
    });

    await expect(service.deactivate(1)).rejects.toThrow(BadRequestException);

    expect(categoryUpdate).not.toHaveBeenCalled();
  });

  it('should reject creating a category with different capitalization', async () => {
    categoryAll.mockResolvedValueOnce([
      {
        id: 1,
        name: 'General',
      },
    ]);

    await expect(service.create({ name: 'general' })).rejects.toThrow(
      ConflictException,
    );

    expect(categoryCreate).not.toHaveBeenCalled();
  });

  it('should reject renaming another category to an existing name regardless of case', async () => {
    categoryFirst.mockResolvedValueOnce({
      id: 1,
      name: 'Electronics',
      isActive: true,
    });

    categoryAll.mockResolvedValueOnce([
      {
        id: 1,
        name: 'Electronics',
      },
      {
        id: 2,
        name: 'General',
      },
    ]);

    await expect(service.update(1, { name: 'GENERAL' })).rejects.toThrow(
      ConflictException,
    );

    expect(categoryUpdate).not.toHaveBeenCalled();
  });

  it('should allow changing capitalization of the same category', async () => {
    categoryFirst.mockResolvedValueOnce({
      id: 1,
      name: 'General',
      isActive: true,
    });

    categoryAll.mockResolvedValueOnce([
      {
        id: 1,
        name: 'General',
      },
    ]);

    const updatedCategory = {
      id: 1,
      name: 'GENERAL',
      isActive: true,
    };

    categoryUpdate.mockResolvedValueOnce(updatedCategory);

    const result = await service.update(1, {
      name: 'GENERAL',
    });

    expect(categoryUpdate).toHaveBeenCalledWith({
      name: 'GENERAL',
    });

    expect(result).toEqual(updatedCategory);
  });
});
