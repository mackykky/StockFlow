import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import jwt from 'jsonwebtoken';
import { DatabaseService } from '../src/database/database.service.js';
import { ThrottlerGuard } from '@nestjs/throttler';


describe('Authentication and authorization (e2e)', () => {
  let app: INestApplication<App>;

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

  const costSensitiveEndpoints = [
    '/reports/inventory-summary',
    '/reports/dashboard',
    '/reports/inventory-summary/export',
  ];

  const generalReportEndpoints = [
    '/reports/low-stock',
    '/reports/stock-movements',
    '/reports/stock-movements/export',
  ];

  const loginAs = async (
    email: string,
    passwordVariable: string,
  ): Promise<string> => {
    const password = process.env[passwordVariable];

    if (!password) {
      throw new Error(
        `Missing ${passwordVariable} in your local test environment.`,
      );
    }

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    return login.body.accessToken as string;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
  imports: [AppModule],
})
  .overrideGuard(ThrottlerGuard)
  .useValue({
    canActivate: () => true,
  })
  .compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should reject login with an unknown email', async () => {
  await request(app.getHttpServer())
    .post('/auth/login')
    .send({
      email: 'unknown-user@stockflow.local',
      password: 'SomePassword123!',
    })
    .expect(401);
});

it('should reject login with an incorrect password', async () => {
  await request(app.getHttpServer())
    .post('/auth/login')
    .send({
      email: 'dev@stockflow.local',
      password: 'WrongPassword123!',
    })
    .expect(401);
});

it('should reject login with an empty email', async () => {
  await request(app.getHttpServer())
    .post('/auth/login')
    .send({
      email: '',
      password: 'SomePassword123!',
    })
    .expect(400);
});

it('should reject login with an empty password', async () => {
  await request(app.getHttpServer())
    .post('/auth/login')
    .send({
      email: 'dev@stockflow.local',
      password: '',
    })
    .expect(400);
});

it('should reject login with an invalid email format', async () => {
  await request(app.getHttpServer())
    .post('/auth/login')
    .send({
      email: 'not-an-email',
      password: 'SomePassword123!',
    })
    .expect(400);
});

it('should allow login with an uppercase email', async () => {
  await request(app.getHttpServer())
    .post('/auth/login')
    .send({
      email: 'DEV@STOCKFLOW.LOCAL',
      password: process.env.E2E_ADMIN_PASSWORD,
    })
    .expect(200);
});

it('should allow login with surrounding email whitespace', async () => {
  await request(app.getHttpServer())
    .post('/auth/login')
    .send({
      email: '  dev@stockflow.local  ',
      password: process.env.E2E_ADMIN_PASSWORD,
    })
    .expect(200);
});

it('should reject login for an inactive account with the correct password', async () => {
  const password = process.env.E2E_INACTIVE_PASSWORD;

  if (!password) {
    throw new Error('Missing E2E_INACTIVE_PASSWORD in your test environment.');
  }

  const databaseService = app.get(DatabaseService);

  const user = await databaseService.db.orm.public.User
    .where({ email: 'inactive.test@stockflow.local' })
    .first();

  if (!user) {
    throw new Error('Inactive E2E test account was not found.');
  }

  const originalIsActive = user.isActive;

  try {
    await databaseService.db.orm.public.User
      .where({ id: user.id })
      .update({ isActive: false });

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'inactive.test@stockflow.local',
        password,
      })
      .expect(401);
  } finally {
    await databaseService.db.orm.public.User
      .where({ id: user.id })
      .update({ isActive: originalIsActive });
  }
});

  it('should reject requests without a JWT', async () => {
    await request(app.getHttpServer()).get('/products').expect(401);
  });

  it('should reject requests with an invalid JWT', async () => {
    await request(app.getHttpServer())
      .get('/products')
      .set('Authorization', 'Bearer invalid.token.value')
      .expect(401);
  });

  it('should reject requests with an expired JWT', async () => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is missing from the test environment.');
  }

  const expiredToken = jwt.sign(
    {
      sub: 1,
      email: 'dev@stockflow.local',
      role: 'ADMIN',
    },
    secret,
    {
      expiresIn: -60,
    },
  );

  await request(app.getHttpServer())
    .get('/products')
    .set('Authorization', `Bearer ${expiredToken}`)
    .expect(401);
});

it('should reject an existing JWT after the user is deactivated', async () => {
  const databaseService = app.get(DatabaseService);

  const user = await databaseService.db.orm.public.User
    .where({ email: 'inactive.test@stockflow.local' })
    .first();

  if (!user) {
    throw new Error('Inactive E2E test account was not found.');
  }


  await databaseService.db.orm.public.User
    .where({ id: user.id })
    .update({ isActive: true });

  try {
    const token = await loginAs(
      'inactive.test@stockflow.local',
      'E2E_INACTIVE_PASSWORD',
    );
    await databaseService.db.orm.public.User
      .where({ id: user.id })
      .update({ isActive: false });

    await request(app.getHttpServer())
      .get('/products')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  } finally {

    await databaseService.db.orm.public.User
      .where({ id: user.id })
      .update({ isActive: true });
  }
});

it('should reject requests with a JWT signed using the wrong secret', async () => {
  const tamperedToken = jwt.sign(
    {
      sub: 1,
      email: 'dev@stockflow.local',
      role: 'ADMIN',
    },
    'wrong-test-secret',
    {
      expiresIn: '5m',
    },
  );

  await request(app.getHttpServer())
    .get('/products')
    .set('Authorization', `Bearer ${tamperedToken}`)
    .expect(401);
});

  it('should reject sales creation without a JWT', async () => {
    await request(app.getHttpServer()).post('/sales').send({}).expect(401);
  });

  it('should reject a STAFF user attempting to supply a userId when creating a sale', async () => {
    const token = await loginAs(
      'staff.test@stockflow.local',
      'E2E_STAFF_PASSWORD',
    );

    await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({
        userId: 1,
        items: [{ productId: 1, quantity: 1 }],
        notes: 'Identity validation test',
      })
      .expect(400);
  });

  it('should reject sales list access without a JWT', async () => {
    await request(app.getHttpServer()).get('/sales').expect(401);
  });

  it('should reject individual sale access without a JWT', async () => {
    await request(app.getHttpServer()).get('/sales/1').expect(401);
  });

  it('should allow STAFF to read products but deny product creation', async () => {
    const token = await loginAs(
      'staff.test@stockflow.local',
      'E2E_STAFF_PASSWORD',
    );

    await request(app.getHttpServer())
      .get('/products')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(403);
  });

  it.each(accounts)(
    '$role should access general report endpoints',
    async ({ email, passwordVariable }) => {
      const token = await loginAs(email, passwordVariable);

      for (const endpoint of generalReportEndpoints) {
        await request(app.getHttpServer())
          .get(endpoint)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
      }
    },
  );

  it.each(accounts.filter((account) => account.role === 'STAFF'))(
    '$role should be denied access to cost-sensitive report endpoints',
    async ({ email, passwordVariable }) => {
      const token = await loginAs(email, passwordVariable);

      for (const endpoint of costSensitiveEndpoints) {
        await request(app.getHttpServer())
          .get(endpoint)
          .set('Authorization', `Bearer ${token}`)
          .expect(403);
      }
    },
  );

  it.each(accounts.filter((account) => account.role !== 'STAFF'))(
    '$role should access cost-sensitive report endpoints',
    async ({ email, passwordVariable }) => {
      const token = await loginAs(email, passwordVariable);

      for (const endpoint of costSensitiveEndpoints) {
        await request(app.getHttpServer())
          .get(endpoint)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
      }
    },
  );
});
