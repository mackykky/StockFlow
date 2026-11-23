
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module.js';

describe('Sales (e2e)', () => {
  let app: INestApplication<App>;

  let adminToken: string;
  let managerToken: string;
  let staffToken: string;
  let categoryId: number;

  const testId = randomUUID().slice(0, 8);

  const loginAs = async (
    email: string,
    passwordVariable: string,
  ): Promise<string> => {
    const password = process.env[passwordVariable];

    if (!password) {
      throw new Error(`Missing ${passwordVariable} in test environment.`);
    }

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    return response.body.accessToken as string;
  };

  const createProduct = (
    overrides: Record<string, unknown> = {},
  ) => {
    return request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sku: `E2E-SALE-${testId}-${randomUUID().slice(0, 8)}`,
        name: 'Sales E2E Product',
        description: 'Product created during sales E2E testing',
        costPrice: 100,
        sellingPrice: 150,
        categoryId,
        ...overrides,
      });
  };

  const createMovement = (
    productId: number,
    quantity: number,
  ) => {
    return request(app.getHttpServer())
      .post('/stock-movements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productId,
        type: 'PURCHASE',
        quantity,
        notes: 'Stock for sales E2E test',
      });
  };

  const createSale = (
    items: Array<{ productId: number; quantity: number }>,
    token: string = adminToken,
    notes?: string,
  ) => {
    return request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items,
        ...(notes !== undefined ? { notes } : {}),
      });
  };

  const getProduct = (productId: number) => {
    return request(app.getHttpServer())
      .get(`/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);
  };

  const getMovements = (productId: number) => {
    return request(app.getHttpServer())
      .get(`/stock-movements/product/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    adminToken = await loginAs(
      'dev@stockflow.local',
      'E2E_ADMIN_PASSWORD',
    );

    managerToken = await loginAs(
      'manager.test@stockflow.local',
      'E2E_MANAGER_PASSWORD',
    );

    staffToken = await loginAs(
      'staff.test@stockflow.local',
      'E2E_STAFF_PASSWORD',
    );

    const categoryResponse = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `E2E Sales Category ${testId}`,
        description: 'Category created during sales E2E testing',
      })
      .expect(201);

    categoryId = categoryResponse.body.id as number;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should reject sale creation without a JWT', async () => {
    await request(app.getHttpServer())
      .post('/sales')
      .send({
        items: [{ productId: 1, quantity: 1 }],
      })
      .expect(401);
  });

  it('should allow ADMIN to complete a sale', async () => {
    const product = await createProduct().expect(201);

    await createMovement(product.body.id, 10).expect(201);

    const response = await createSale([
      { productId: product.body.id, quantity: 2 },
    ]).expect(201);

    expect(response.body.message).toBe('Sale completed successfully.');
    expect(response.body.sale.id).toBeDefined();
    expect(response.body.sale.saleNumber).toMatch(/^SF-/);
    expect(response.body.sale.status).toBe('COMPLETED');
    expect(response.body.sale.soldById).toBeDefined();
    expect(response.body.sale.items).toHaveLength(1);
    expect(response.body.sale.items[0].productId).toBe(product.body.id);
    expect(response.body.sale.items[0].quantity).toBe(2);
    expect(response.body.sale.subtotal).toBe('300.00');
    expect(response.body.sale.total).toBe('300.00');

    const updatedProduct = await getProduct(product.body.id).expect(200);

    expect(updatedProduct.body.stockQuantity).toBe(8);

    const movements = await getMovements(product.body.id).expect(200);

    const saleMovement = movements.body.find(
      (movement: { type: string }) => movement.type === 'SALE',
    );

    expect(saleMovement).toBeDefined();
    expect(saleMovement.quantity).toBe(2);
    expect(saleMovement.quantityAfter).toBe(8);
  });

  it('should allow MANAGER to complete a sale', async () => {
    const product = await createProduct().expect(201);

    await createMovement(product.body.id, 10).expect(201);

    const response = await createSale(
      [{ productId: product.body.id, quantity: 3 }],
      managerToken,
    ).expect(201);

    expect(response.body.sale.items).toHaveLength(1);
    expect(response.body.sale.items[0].quantity).toBe(3);
  });

  it('should allow STAFF to complete a sale under the current controller policy', async () => {
    const product = await createProduct().expect(201);

    await createMovement(product.body.id, 10).expect(201);

    const response = await createSale(
      [{ productId: product.body.id, quantity: 1 }],
      staffToken,
    ).expect(201);

    expect(response.body.sale.status).toBe('COMPLETED');
    expect(response.body.sale.items[0].quantity).toBe(1);
  });

  it('should reject a sale when stock is insufficient', async () => {
    const product = await createProduct().expect(201);

    await createMovement(product.body.id, 2).expect(201);

    await createSale([
      { productId: product.body.id, quantity: 3 },
    ]).expect(400);

    const updatedProduct = await getProduct(product.body.id).expect(200);

    expect(updatedProduct.body.stockQuantity).toBe(2);

    const movements = await getMovements(product.body.id).expect(200);

    expect(
      movements.body.filter(
        (movement: { type: string }) => movement.type === 'SALE',
      ),
    ).toHaveLength(0);
  });


  it('should roll back the entire sale when one product has insufficient stock', async () => {
    const productA = await createProduct({
      name: 'Rollback Test Product A',
    }).expect(201);

    const productB = await createProduct({
      name: 'Rollback Test Product B',
    }).expect(201);

    await createMovement(productA.body.id, 10).expect(201);
    await createMovement(productB.body.id, 2).expect(201);

    const salesBefore = await request(app.getHttpServer())
      .get('/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await createSale([
      { productId: productA.body.id, quantity: 5 },
      { productId: productB.body.id, quantity: 3 },
    ]).expect(400);

    const updatedProductA = await getProduct(productA.body.id).expect(200);
    const updatedProductB = await getProduct(productB.body.id).expect(200);

    expect(updatedProductA.body.stockQuantity).toBe(10);
    expect(updatedProductB.body.stockQuantity).toBe(2);

    const movementsA = await getMovements(productA.body.id).expect(200);
    const movementsB = await getMovements(productB.body.id).expect(200);

    expect(
      movementsA.body.filter(
        (movement: { type: string }) => movement.type === 'SALE',
      ),
    ).toHaveLength(0);

    expect(
      movementsB.body.filter(
        (movement: { type: string }) => movement.type === 'SALE',
      ),
    ).toHaveLength(0);

    const salesAfter = await request(app.getHttpServer())
      .get('/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(salesAfter.body).toHaveLength(salesBefore.body.length);
  });


  it('should reject a sale containing a nonexistent product', async () => {
    await createSale([
      { productId: 999999999, quantity: 1 },
    ]).expect(404);
  });

  it('should reject a sale containing an inactive product', async () => {
    const product = await createProduct().expect(201);

    await request(app.getHttpServer())
      .patch(`/products/${product.body.id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await createSale([
      { productId: product.body.id, quantity: 1 },
    ]).expect(400).expect(response => expect(response.body.message).toContain('inactive'));
  });

  it('should reject duplicate products in the same sale', async () => {
    const product = await createProduct().expect(201);

    await createMovement(product.body.id, 10).expect(201);

    await createSale([
      { productId: product.body.id, quantity: 1 },
      { productId: product.body.id, quantity: 2 },
    ]).expect(400);
  });

  it('should reject an empty sale', async () => {
    await createSale([]).expect(400);
  });

  it('should reject a sale with no items field', async () => {
    await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(400);
  });

  it('should reject a sale with zero quantity', async () => {
    const product = await createProduct().expect(201);

    await createSale([
      { productId: product.body.id, quantity: 0 },
    ]).expect(400);
  });

  it('should reject a sale with negative quantity', async () => {
    const product = await createProduct().expect(201);

    await createSale([
      { productId: product.body.id, quantity: -1 },
    ]).expect(400);
  });

  it('should reject a sale with a non-integer quantity', async () => {
    const product = await createProduct().expect(201);

    await createSale([
      { productId: product.body.id, quantity: 1.5 },
    ]).expect(400);
  });

  it('should save sale notes', async () => {
    const product = await createProduct().expect(201);

    await createMovement(product.body.id, 10).expect(201);

    const response = await createSale(
      [{ productId: product.body.id, quantity: 1 }],
      adminToken,
      'E2E test sale notes',
    ).expect(201);

    expect(response.body.sale.notes).toBe('E2E test sale notes');
  });

  it('should retrieve a completed sale by ID with its items', async () => {
    const product = await createProduct().expect(201);

    await createMovement(product.body.id, 10).expect(201);

    const created = await createSale([
      { productId: product.body.id, quantity: 2 },
    ]).expect(201);

    const response = await request(app.getHttpServer())
      .get(`/sales/${created.body.sale.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.id).toBe(created.body.sale.id);
    expect(response.body.saleNumber).toBe(created.body.sale.saleNumber);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].productId).toBe(product.body.id);
    expect(response.body.items[0].quantity).toBe(2);
  });

  it('should return 404 for a nonexistent sale', async () => {
    await request(app.getHttpServer())
      .get('/sales/999999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('should allow authenticated users to list sales', async () => {
    const response = await request(app.getHttpServer())
      .get('/sales')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });

  it('should reject viewing sales without a JWT', async () => {
    await request(app.getHttpServer())
      .get('/sales')
      .expect(401);

    await request(app.getHttpServer())
      .get('/sales/1')
      .expect(401);
  });

  it('should reject a sale with a nonexistent product without creating a sale', async () => {
    const before = await request(app.getHttpServer())
      .get('/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await createSale([
      { productId: 999999999, quantity: 1 },
    ]).expect(404);

    const after = await request(app.getHttpServer())
      .get('/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(after.body).toHaveLength(before.body.length);
  });
});
