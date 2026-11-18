
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

describe('ReportsController', () => {
  let controller: ReportsController;
  let reportsService: {
    getInventorySummary: ReturnType<typeof vi.fn>;
    getLowStockProducts: ReturnType<typeof vi.fn>;
    getStockMovements: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    reportsService = {
      getInventorySummary: vi.fn().mockResolvedValue({
        totalActiveProducts: 0,
        totalStockUnits: 0,
        inventoryCostValue: '0.00',
        lowStockProducts: 0,
        outOfStockProducts: 0,
      }),
      getLowStockProducts: vi.fn().mockResolvedValue([]),
      getStockMovements: vi.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        {
          provide: ReportsService,
          useValue: reportsService,
        },
      ],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return the inventory summary', async () => {
    await expect(controller.getInventorySummary()).resolves.toEqual({
      totalActiveProducts: 0,
      totalStockUnits: 0,
      inventoryCostValue: '0.00',
      lowStockProducts: 0,
      outOfStockProducts: 0,
    });
  });

  it('should return low-stock products', async () => {
    await expect(controller.getLowStockProducts()).resolves.toEqual([]);
  });

  it('should request all stock movements without filters', async () => {
    await expect(controller.getStockMovements()).resolves.toEqual([]);

    expect(reportsService.getStockMovements).toHaveBeenCalledWith({
      productId: undefined,
      type: undefined,
      startDate: undefined,
      endDate: undefined,
    });
  });

  it('should pass valid filters to the service', async () => {
    await controller.getStockMovements(
      '2',
      'PURCHASE',
      '2026-10-01',
      '2026-10-17',
    );

    expect(reportsService.getStockMovements).toHaveBeenCalledWith({
      productId: 2,
      type: 'PURCHASE',
      startDate: '2026-10-01',
      endDate: '2026-10-17',
    });
  });

  it('should reject an invalid product ID', () => {
    expect(() => controller.getStockMovements('abc')).toThrow(
      BadRequestException,
    );
  });

  it('should reject an invalid movement type', () => {
    expect(() => controller.getStockMovements(undefined, 'INVALID')).toThrow(
      BadRequestException,
    );
  });

  it('should reject a start date after the end date', () => {
    expect(() =>
      controller.getStockMovements(
        undefined,
        undefined,
        '2026-10-17',
        '2026-10-01',
      ),
    ).toThrow(BadRequestException);
  });
});
