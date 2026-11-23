
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module.js';

describe('Products (e2e)', () => {
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
    token: string = adminToken,
    overrides: Record<string, unknown> = {},
  ) => {
    return request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sku: `E2E-${testId}-${randomUUID().slice(0, 8)}`,
        name: 'E2E Test Product',
        description: 'Product created during E2E testing',
        costPrice: 100,
        sellingPrice: 150,
        categoryId,
        ...overrides,
      });
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
        name: `E2E Category ${testId}`,
        description: 'Category created during E2E testing',
      })
      .expect(201);

    categoryId = categoryResponse.body.id as number;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should reject product listing without a JWT', async () => {
    await request(app.getHttpServer())
      .get('/products')
      .expect(401);
  });

  it('should allow ADMIN to create a product', async () => {
    const response = await createProduct();

    expect(response.status).toBe(201);
    expect(response.body.id).toBeDefined();
    expect(response.body.sku).toContain(`E2E-${testId}`);
    expect(response.body.name).toBe('E2E Test Product');
    expect(response.body.categoryId).toBe(categoryId);
    expect(response.body.stockQuantity).toBe(0);
    expect(response.body.isActive).toBe(true);
  });

  it('should reject creating a product with stockQuantity', async () => {
  await createProduct(adminToken, {
    stockQuantity: 25,
  }).expect(400);
});

  it('should allow MANAGER to create a product', async () => {
    const response = await createProduct(managerToken);

    expect(response.status).toBe(201);
    expect(response.body.id).toBeDefined();
  });

  it('should deny STAFF from creating a product', async () => {
    const response = await createProduct(staffToken);

    expect(response.status).toBe(403);
  });

  it('should reject a product with a duplicate SKU', async () => {
    const sku = `E2E-DUP-${testId}`;

    await createProduct(adminToken, { sku }).expect(201);

    await createProduct(adminToken, { sku }).expect(409);
  });

  it('should reject a product with an invalid category', async () => {
    await createProduct(adminToken, {
      categoryId: 999999999,
    }).expect(400);
  });

  it('should reject invalid product input', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sku: '',
        name: '',
        costPrice: -1,
        sellingPrice: 150,
        categoryId: 0,
      })
      .expect(400);
  });

  it('should allow authenticated users to list products', async () => {
    const response = await request(app.getHttpServer())
      .get('/products')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });

  it('should retrieve a product by ID', async () => {
    const created = await createProduct().expect(201);

    const response = await request(app.getHttpServer())
      .get(`/products/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.id).toBe(created.body.id);
    expect(response.body.sku).toBe(created.body.sku);
  });

  it('should return 404 for a product that does not exist', async () => {
    await request(app.getHttpServer())
      .get('/products/999999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('should allow ADMIN to update a product', async () => {
    const created = await createProduct().expect(201);

    const response = await request(app.getHttpServer())
      .patch(`/products/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated E2E Product' })
      .expect(200);

    expect(response.body.name).toBe('Updated E2E Product');
  });

  it('should reject updating stockQuantity directly and preserve existing stock', async () => {
  const created = await createProduct().expect(201);

  await request(app.getHttpServer())
    .patch(`/products/${created.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ stockQuantity: 25 })
    .expect(400);

  const response = await request(app.getHttpServer())
    .get(`/products/${created.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);

  expect(response.body.stockQuantity).toBe(0);
});

  it('should allow MANAGER to update a product', async () => {
    const created = await createProduct().expect(201);

    const response = await request(app.getHttpServer())
      .patch(`/products/${created.body.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'Manager Updated Product' })
      .expect(200);

    expect(response.body.name).toBe('Manager Updated Product');
  });

  it('should deny STAFF from updating a product', async () => {
    const created = await createProduct().expect(201);

    await request(app.getHttpServer())
      .patch(`/products/${created.body.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'Unauthorized Update' })
      .expect(403);
  });

  it('should reject an update with a blank product name', async () => {
    const created = await createProduct().expect(201);

    await request(app.getHttpServer())
      .patch(`/products/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '   ' })
      .expect(400);
  });

  it('should allow ADMIN to deactivate a product', async () => {
    const created = await createProduct().expect(201);

    const response = await request(app.getHttpServer())
      .patch(`/products/${created.body.id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.isActive).toBe(false);
  });

  it('protects stock and category assignments through archive and restore', async () => {
    const api = request(app.getHttpServer());
    const auth = `Bearer ${adminToken}`;
    const category = await api.post('/categories').set('Authorization', auth)
      .send({ name: `Archive test ${testId}` }).expect(201);
    const product = await createProduct(adminToken, { categoryId: category.body.id }).expect(201);
    const productUrl = `/products/${product.body.id}`;
    const categoryUrl = `/categories/${category.body.id}`;
    const patch = (url: string) => api.patch(url).set('Authorization', auth);
    const move = (type: string) => api.post('/stock-movements').set('Authorization', auth)
      .send({ productId: product.body.id, type, quantity: 3 }).expect(201);
    await move('PURCHASE');
    await patch(productUrl + '/archive').expect(409);
    await patch(categoryUrl + '/deactivate').expect(409);
    const inactive = await patch(productUrl + '/deactivate').expect(200);
    expect(inactive.body).toMatchObject({ isActive: false, isSuspended: true, stockQuantity: 3 });
    await api.post('/stock-movements').set('Authorization', auth)
      .send({ productId: product.body.id, type: 'PURCHASE', quantity: 1 }).expect(400);
    await patch(productUrl + '/archive').expect(409);
    await move('ADJUSTMENT_OUT');
    await patch(productUrl + '/archive').expect(200);
    await api.post('/stock-movements').set('Authorization', auth)
      .send({ productId: product.body.id, type: 'RETURN_OUT', quantity: 1 }).expect(400);
    await patch(categoryUrl + '/deactivate').expect(200);
    await patch(productUrl + '/activate').expect(409);
    const restored = await patch(productUrl + '/restore').expect(200);
    expect(restored.body).toMatchObject({ isActive: false, isSuspended: true, stockQuantity: 0 });
    await patch(productUrl + '/activate').expect(409);
    await patch(categoryUrl + '/activate').expect(200);
    await patch(productUrl + '/activate').expect(200);
    const history = await api.get('/stock-movements/product/' + product.body.id).set('Authorization', auth).expect(200);
    expect(history.body).toHaveLength(2);
  });

  it('should deny MANAGER from deactivating a product', async () => {
    const created = await createProduct().expect(201);

    await request(app.getHttpServer())
      .patch(`/products/${created.body.id}/deactivate`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(403);
  });

  it('allows only an admin to reactivate a product and preserves its data', async () => {
    const created = await createProduct().expect(201);
    const url = `/products/${created.body.id}`;
    const api = request(app.getHttpServer());
    await api.patch(`${url}/deactivate`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    for (const token of [managerToken, staffToken]) {
      await api.patch(`${url}/activate`).set('Authorization', `Bearer ${token}`).expect(403);
    }

    await api.patch(`${url}/activate`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    const restored = await api.get(url).set('Authorization', `Bearer ${staffToken}`).expect(200);
    expect(restored.body).toMatchObject({
      id: created.body.id, sku: created.body.sku, name: created.body.name,
      categoryId, stockQuantity: created.body.stockQuantity, isActive: true,
    });
    await api.patch(`${url}/activate`).set('Authorization', `Bearer ${adminToken}`).expect(400);
  });

  it('should deny STAFF from deactivating a product', async () => {
    const created = await createProduct().expect(201);

    await request(app.getHttpServer())
      .patch(`/products/${created.body.id}/deactivate`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(403);
  });
});
