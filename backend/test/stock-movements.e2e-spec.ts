
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module.js';

describe('Stock Movements (e2e)', () => {
  let app: INestApplication<App>;

  let adminToken: string;
  let managerToken: string;
  let staffToken: string;
  let categoryId: number;

  const testId = randomUUID().slice(0, 8);

  const accounts = [
    {
      role: 'ADMIN',
      email: 'dev@stockflow.local',
      passwordVariable: 'E2E_ADMIN_PASSWORD',
    },
    {
      role: 'MANAGER',
      email: 'manager.test@stockflow.local',
      passwordVariable: 'E2E_MANAGER_PASSWORD',
    },
    {
      role: 'STAFF',
      email: 'staff.test@stockflow.local',
      passwordVariable: 'E2E_STAFF_PASSWORD',
    },
  ] as const;

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
    token: string = adminToken,
    overrides: Record<string, unknown> = {},
  ) => {
    return request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sku: `E2E-SM-${testId}-${randomUUID().slice(0, 8)}`,
        name: 'Stock Movement E2E Product',
        description: 'Product created during stock movement E2E testing',
        costPrice: 100,
        sellingPrice: 150,
        categoryId,
        ...overrides,
      });
  };

  const createMovement = (
    productId: number,
    type: string,
    quantity: number,
    token: string = adminToken,
    notes?: string,
  ) => {
    return request(app.getHttpServer())
      .post('/stock-movements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId,
        type,
        quantity,
        ...(notes !== undefined ? { notes } : {}),
      });
  };

  const getProduct = (productId: number, token: string = adminToken) => {
    return request(app.getHttpServer())
      .get(`/products/${productId}`)
      .set('Authorization', `Bearer ${token}`);
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
        name: `E2E Stock Movement Category ${testId}`,
        description: 'Category created during stock movement E2E testing',
      })
      .expect(201);

    categoryId = categoryResponse.body.id as number;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should reject stock movement creation without a JWT', async () => {
    const product = await createProduct().expect(201);

    await request(app.getHttpServer())
      .post('/stock-movements')
      .send({
        productId: product.body.id,
        type: 'PURCHASE',
        quantity: 10,
      })
      .expect(401);
  });

  it('should allow ADMIN to record inbound stock', async () => {
    const product = await createProduct().expect(201);

    const response = await createMovement(
      product.body.id,
      'PURCHASE',
      10,
    ).expect(201);

    expect(response.body.message).toBe(
      'Stock movement recorded successfully.',
    );
    expect(response.body.movement.type).toBe('PURCHASE');
    expect(response.body.movement.quantity).toBe(10);
    expect(response.body.movement.productId).toBe(product.body.id);
    expect(response.body.stock.previousQuantity).toBe(0);
    expect(response.body.stock.movementQuantity).toBe(10);
    expect(response.body.stock.quantityAfter).toBe(10);

    const updatedProduct = await getProduct(product.body.id).expect(200);

    expect(updatedProduct.body.stockQuantity).toBe(10);
  });

  it('should allow MANAGER to record inbound stock', async () => {
    const product = await createProduct().expect(201);

    const response = await createMovement(
      product.body.id,
      'PURCHASE',
      5,
      managerToken,
    ).expect(201);

    expect(response.body.movement.type).toBe('PURCHASE');
    expect(response.body.stock.quantityAfter).toBe(5);
  });

  it('should deny STAFF from recording stock movements', async () => {
    const product = await createProduct().expect(201);

    await createMovement(
      product.body.id,
      'PURCHASE',
      10,
      staffToken,
    ).expect(403);

    const updatedProduct = await getProduct(product.body.id).expect(200);

    expect(updatedProduct.body.stockQuantity).toBe(0);
  });


it('should reject ADMIN from manually creating a SALE movement', async () => {
  const product = await createProduct().expect(201);

  await createMovement(
    product.body.id,
    'PURCHASE',
    10,
  ).expect(201);

  await createMovement(
    product.body.id,
    'SALE',
    3,
    adminToken,
  ).expect(400);

  const updatedProduct = await getProduct(product.body.id).expect(200);

  expect(updatedProduct.body.stockQuantity).toBe(10);
});

it('should reject MANAGER from manually creating a SALE movement', async () => {
  const product = await createProduct().expect(201);

  await createMovement(
    product.body.id,
    'PURCHASE',
    10,
  ).expect(201);

  await createMovement(
    product.body.id,
    'SALE',
    3,
    managerToken,
  ).expect(400);

  const updatedProduct = await getProduct(product.body.id).expect(200);

  expect(updatedProduct.body.stockQuantity).toBe(10);
});


  it('should increase stock for inbound movements', async () => {
    const product = await createProduct().expect(201);

    await createMovement(product.body.id, 'PURCHASE', 10).expect(201);

    const response = await createMovement(
      product.body.id,
      'RETURN_IN',
      3,
    ).expect(201);

    expect(response.body.stock.previousQuantity).toBe(10);
    expect(response.body.stock.quantityAfter).toBe(13);

    const updatedProduct = await getProduct(product.body.id).expect(200);

    expect(updatedProduct.body.stockQuantity).toBe(13);
  });

  it('should decrease stock for outbound movements', async () => {
    const product = await createProduct().expect(201);

    await createMovement(product.body.id, 'PURCHASE', 10).expect(201);

    const response = await createMovement(
      product.body.id,
      'ADJUSTMENT_OUT',
      4,
    ).expect(201);

    expect(response.body.stock.previousQuantity).toBe(10);
    expect(response.body.stock.quantityAfter).toBe(6);

    const updatedProduct = await getProduct(product.body.id).expect(200);

    expect(updatedProduct.body.stockQuantity).toBe(6);
  });

  it('should reject an outbound movement when stock is insufficient', async () => {
    const product = await createProduct().expect(201);

    await createMovement(product.body.id, 'ADJUSTMENT_OUT', 1).expect(400);

    const updatedProduct = await getProduct(product.body.id).expect(200);

    expect(updatedProduct.body.stockQuantity).toBe(0);
  });

  it('should reject an opening stock movement with zero quantity', async () => {
    const product = await createProduct().expect(201);

    await createMovement(product.body.id, 'OPENING_STOCK', 0).expect(400);
  });

  it('should allow opening stock when the product has zero stock', async () => {
    const product = await createProduct().expect(201);

    const response = await createMovement(
      product.body.id,
      'OPENING_STOCK',
      20,
    ).expect(201);

    expect(response.body.stock.previousQuantity).toBe(0);
    expect(response.body.stock.quantityAfter).toBe(20);

    const updatedProduct = await getProduct(product.body.id).expect(200);

    expect(updatedProduct.body.stockQuantity).toBe(20);
  });

  it('should reject opening stock when the product already has stock', async () => {
    const product = await createProduct().expect(201);

    await createMovement(product.body.id, 'PURCHASE', 5).expect(201);

    await createMovement(
      product.body.id,
      'OPENING_STOCK',
      10,
    ).expect(400);

    const updatedProduct = await getProduct(product.body.id).expect(200);

    expect(updatedProduct.body.stockQuantity).toBe(5);
  });

  it('should reject a movement for a product that does not exist', async () => {
    await createMovement(
      999999999,
      'PURCHASE',
      10,
    ).expect(404);
  });

  it('should reject an unsupported movement type', async () => {
    const product = await createProduct().expect(201);

    await createMovement(
      product.body.id,
      'INVALID_TYPE',
      10,
    ).expect(400);
  });

  it('should reject a quantity of zero', async () => {
    const product = await createProduct().expect(201);

    await createMovement(
      product.body.id,
      'PURCHASE',
      0,
    ).expect(400);
  });

  it('should reject a negative quantity', async () => {
    const product = await createProduct().expect(201);

    await createMovement(
      product.body.id,
      'PURCHASE',
      -5,
    ).expect(400);
  });

  it('should reject a non-integer quantity', async () => {
    const product = await createProduct().expect(201);

    await createMovement(
      product.body.id,
      'PURCHASE',
      1.5,
    ).expect(400);
  });

  it('should reject a movement for an inactive product', async () => {
    const product = await createProduct().expect(201);

    await request(app.getHttpServer())
      .patch(`/products/${product.body.id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await createMovement(
      product.body.id,
      'PURCHASE',
      10,
    ).expect(400);
  });

  it('should allow authenticated users to view all stock movements', async () => {
    const product = await createProduct().expect(201);

    await createMovement(product.body.id, 'PURCHASE', 10).expect(201);

    const response = await request(app.getHttpServer())
      .get('/stock-movements')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(
      response.body.some(
        (movement: { productId: number }) =>
          movement.productId === product.body.id,
      ),
    ).toBe(true);
  });

  it('should allow authenticated users to view movements for a product', async () => {
    const product = await createProduct().expect(201);

    await createMovement(product.body.id, 'PURCHASE', 10).expect(201);
    await createMovement(product.body.id, 'ADJUSTMENT_OUT', 2).expect(201);

    const response = await request(app.getHttpServer())
      .get(`/stock-movements/product/${product.body.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(2);
    expect(
      response.body.every(
        (movement: { productId: number }) =>
          movement.productId === product.body.id,
      ),
    ).toBe(true);
  });

  it('should return 404 when viewing movements for a nonexistent product', async () => {
    await request(app.getHttpServer())
      .get('/stock-movements/product/999999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('should reject viewing stock movements without a JWT', async () => {
    await request(app.getHttpServer())
      .get('/stock-movements')
      .expect(401);

    await request(app.getHttpServer())
      .get('/stock-movements/product/1')
      .expect(401);
  });
});
