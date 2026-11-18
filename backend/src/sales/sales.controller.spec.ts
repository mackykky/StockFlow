import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SalesController } from './sales.controller.js';
import { SalesService } from './sales.service.js';
import type { CreateSaleDto } from './dto/create-sale.dto.js';

describe('SalesController', () => {
  let controller: SalesController;

  const salesService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SalesController],
      providers: [
        {
          provide: SalesService,
          useValue: salesService,
        },
      ],
    }).compile();

    controller = module.get<SalesController>(SalesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should pass the authenticated user ID to the sales service', async () => {
    const dto: CreateSaleDto = {
      items: [{ productId: 1, quantity: 2 }],
      notes: 'Customer purchase',
    };

    const authenticatedRequest = {
      user: {
        id: 10,
        email: 'staff.test@stockflow.local',
        role: 'STAFF',
      },
    };

    salesService.create.mockResolvedValue({
      message: 'Sale completed successfully.',
    });

    await controller.create(dto, authenticatedRequest as never);

    expect(salesService.create).toHaveBeenCalledWith(dto, 10);
  });

  it('should return all sales', async () => {
    salesService.findAll.mockResolvedValue([]);

    await expect(controller.findAll()).resolves.toEqual([]);

    expect(salesService.findAll).toHaveBeenCalledOnce();
  });

  it('should return a sale by ID', async () => {
    const sale = { id: 1, saleNumber: 'SF-TEST-001' };

    salesService.findById.mockResolvedValue(sale);

    await expect(controller.findById(1)).resolves.toEqual(sale);

    expect(salesService.findById).toHaveBeenCalledWith(1);
  });
});
