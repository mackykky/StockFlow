
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { StockMovementTypeInput } from '../stock-movements/dto/create-stock-movement.dto.js';

interface StockMovementReportFilters {
  productId?: number;
  type?: StockMovementTypeInput;
  startDate?: string;
  endDate?: string;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly databaseService: DatabaseService,
  ) {}

  async getInventorySummary() {
    const products =
      await this.databaseService.db.orm.public.Product
        .where({})
        .all();

    const activeProducts = products.filter(
      (product) => product.isActive,
    );

    const totalStockUnits = activeProducts.reduce(
      (total, product) => total + product.stockQuantity,
      0,
    );

    const inventoryCostValue = activeProducts.reduce(
      (total, product) =>
        total +
        Number(product.costPrice) * product.stockQuantity,
      0,
    );

    return {
      totalActiveProducts: activeProducts.length,
      totalStockUnits,
      inventoryCostValue: inventoryCostValue.toFixed(2),
      lowStockProducts: activeProducts.filter(
        (product) =>
          product.stockQuantity <= product.reorderLevel,
      ).length,
      outOfStockProducts: activeProducts.filter(
        (product) => product.stockQuantity === 0,
      ).length,
    };
  }

  async getLowStockProducts() {
    const products =
      await this.databaseService.db.orm.public.Product
        .where({})
        .all();

    return products
      .filter(
        (product) =>
          product.isActive &&
          product.stockQuantity <= product.reorderLevel,
      )
      .map((product) => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
        stockQuantity: product.stockQuantity,
        reorderLevel: product.reorderLevel,
        shortage: Math.max(
          0,
          product.reorderLevel - product.stockQuantity,
        ),
        categoryId: product.categoryId,
      }));
  }


async getStockMovements(
  filters: StockMovementReportFilters = {},
) {
  const movements =
    await this.databaseService.db.orm.public.StockMovement
      .where({})
      .all();

  const products =
    await this.databaseService.db.orm.public.Product
      .where({})
      .all();

  const productsById = new Map(
    products.map((product) => [
      product.id,
      {
        sku: product.sku,
        name: product.name,
      },
    ]),
  );

  const startTimestamp = filters.startDate
    ? new Date(`${filters.startDate}T00:00:00.000Z`).getTime()
    : undefined;

  const endTimestamp = filters.endDate
    ? new Date(`${filters.endDate}T23:59:59.999Z`).getTime()
    : undefined;

  return movements
    .filter((movement) => {
      if (
        filters.productId !== undefined &&
        movement.productId !== filters.productId
      ) {
        return false;
      }

      if (
        filters.type !== undefined &&
        movement.type !== filters.type
      ) {
        return false;
      }

      const movementTimestamp = new Date(
        movement.createdAt,
      ).getTime();

      if (
        startTimestamp !== undefined &&
        movementTimestamp < startTimestamp
      ) {
        return false;
      }

      if (
        endTimestamp !== undefined &&
        movementTimestamp > endTimestamp
      ) {
        return false;
      }

      return true;
    })
    .map((movement) => ({
      ...movement,
      product: productsById.get(movement.productId) ?? {
        sku: 'UNKNOWN',
        name: 'Unknown Product',
      },
    }))
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime(),
    );
}


async getInventorySummaryProducts() {
  const products =
    await this.databaseService.db.orm.public.Product
      .where({})
      .all();

  const categories =
    await this.databaseService.db.orm.public.Category
      .where({})
      .all();

  const categoriesById = new Map(
    categories.map((category) => [
      category.id,
      category.name,
    ]),
  );

  const activeProducts = products.filter(
    (product) => product.isActive,
  );

  return activeProducts.map((product) => ({
    sku: product.sku,
    name: product.name,
    categoryName:
      categoriesById.get(product.categoryId) ?? 'Unknown Category',
    stockQuantity: product.stockQuantity,
    costPrice: Number(product.costPrice).toFixed(2),
  }));
}



async getDashboard() {
  const inventorySummary = await this.getInventorySummary();

  const sales =
    await this.databaseService.db.orm.public.Sale
      .where({})
      .all();


  const completedSales = sales.filter(
    (sale) => sale.status === 'COMPLETED',
  );


  const today = new Date();

  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);


  const startOfYesterday = new Date(startOfDay);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  const endOfYesterday = new Date(startOfDay);
  endOfYesterday.setMilliseconds(-1);


  const todaysSales = completedSales.filter((sale) => {
    const saleDate = new Date(sale.createdAt).getTime();

    return (
      saleDate >= startOfDay.getTime() &&
      saleDate <= endOfDay.getTime()
    );
  });


  const yesterdaysSales = completedSales.filter((sale) => {
    const saleDate = new Date(sale.createdAt).getTime();

    return (
      saleDate >= startOfYesterday.getTime() &&
      saleDate <= endOfYesterday.getTime()
    );
  });


  const todaysSalesTotal = todaysSales.reduce(
    (total, sale) => total + Number(sale.total),
    0,
  );


  const yesterdaysSalesTotal = yesterdaysSales.reduce(
    (total, sale) => total + Number(sale.total),
    0,
  );

  const recentMovements = (
    await this.getStockMovements()
  ).slice(0, 5);

  const topSellingProducts =
  await this.getTopSellingProducts();

  const lowStockProducts =
  await this.getLowStockProducts();

  const salesTrends = await this.getSalesTrends();

  return {
    inventory: inventorySummary,
    sales: {
      todayCount: todaysSales.length,
      todayTotal: todaysSalesTotal.toFixed(2),
      yesterdayCount: yesterdaysSales.length,
      yesterdayTotal: yesterdaysSalesTotal.toFixed(2),
    },
    topSellingProducts,
    lowStockProducts,
    salesTrends,
    recentMovements,
  };
}


async getTopSellingProducts() {
  const saleItems =
    await this.databaseService.db.orm.public.SaleItem
      .where({})
      .all();

  const sales =
    await this.databaseService.db.orm.public.Sale
      .where({})
      .all();

  const products =
    await this.databaseService.db.orm.public.Product
      .where({})
      .all();

  const completedSaleIds = new Set(
    sales
      .filter((sale) => sale.status === 'COMPLETED')
      .map((sale) => sale.id),
  );

  const productsById = new Map(
    products.map((product) => [
      product.id,
      {
        id: product.id,
        sku: product.sku,
        name: product.name,
      },
    ]),
  );

  const quantitiesByProduct = new Map<number, number>();

  for (const item of saleItems) {
    if (!completedSaleIds.has(item.saleId)) {
      continue;
    }

    const currentQuantity =
      quantitiesByProduct.get(item.productId) ?? 0;

    quantitiesByProduct.set(
      item.productId,
      currentQuantity + item.quantity,
    );
  }

  return Array.from(quantitiesByProduct.entries())
    .map(([productId, totalQuantitySold]) => ({
      product: productsById.get(productId) ?? null,
      totalQuantitySold,
    }))
    .filter((item) => item.product !== null)
    .sort(
      (a, b) =>
        b.totalQuantitySold - a.totalQuantitySold,
    )
    .slice(0, 5);
}

async getSalesTrends() {
  const sales =
    await this.databaseService.db.orm.public.Sale
      .where({})
      .all();

  const completedSales = sales.filter(
    (sale) => sale.status === 'COMPLETED',
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dailySales = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));

    return {
      date,
      dateLabel: date.toISOString().slice(0, 10),
      salesCount: 0,
      revenue: 0,
    };
  });

  for (const sale of completedSales) {
    const saleDate = new Date(sale.createdAt);
    saleDate.setHours(0, 0, 0, 0);

    const matchingDay = dailySales.find(
      (day) => day.date.getTime() === saleDate.getTime(),
    );

    if (matchingDay) {
      matchingDay.salesCount += 1;
      matchingDay.revenue += Number(sale.total);
    }
  }

  const totalRevenue = dailySales.reduce(
    (total, day) => total + day.revenue,
    0,
  );

  const totalSales = dailySales.reduce(
    (total, day) => total + day.salesCount,
    0,
  );

  const bestSalesDay =
  totalSales === 0
    ? null
    : dailySales.reduce((best, day) =>
        day.revenue > best.revenue ? day : best,
      );

  return {
    period: 'LAST_7_DAYS',
    totalSales,
    totalRevenue: totalRevenue.toFixed(2),
    bestSalesDay: bestSalesDay
  ? {
      date: bestSalesDay.dateLabel,
      revenue: bestSalesDay.revenue.toFixed(2),
    }
  : null,
    dailySales: dailySales.map((day) => ({
      date: day.dateLabel,
      salesCount: day.salesCount,
      revenue: day.revenue.toFixed(2),
    })),
  };
}

}
