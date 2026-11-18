
import 'dotenv/config';

import * as argon2 from 'argon2';
import postgres from '@prisma/orm-postgres/runtime';
import contractJson from '../src/prisma/contract.json' with {
  type: 'json',
};

// Safety check: this script must only run against the test database.
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is missing from the test environment.');
}

const parsedDatabaseUrl = new URL(databaseUrl);
const databaseName = decodeURIComponent(
  parsedDatabaseUrl.pathname.replace(/^\/+/, ''),
);

if (databaseName !== 'stockflow_test') {
  throw new Error(
    'Safety check failed: this script may only use the stockflow_test database.',
  );
}

// Read all passwords before connecting to the database.
const accounts = [
  {
    email: 'dev@stockflow.local',
    passwordVariable: 'E2E_ADMIN_PASSWORD',
    firstName: 'E2E',
    lastName: 'Admin',
    role: 'ADMIN',
  },
  {
    email: 'manager.test@stockflow.local',
    passwordVariable: 'E2E_MANAGER_PASSWORD',
    firstName: 'E2E',
    lastName: 'Manager',
    role: 'MANAGER',
  },
  {
    email: 'staff.test@stockflow.local',
    passwordVariable: 'E2E_STAFF_PASSWORD',
    firstName: 'E2E',
    lastName: 'Staff',
    role: 'STAFF',
  },
    {
    email: 'inactive.test@stockflow.local',
    passwordVariable: 'E2E_INACTIVE_PASSWORD',
    firstName: 'E2E',
    lastName: 'Inactive',
    role: 'STAFF',
    isActive: false,
  },
];

for (const account of accounts) {
  const password = process.env[account.passwordVariable];

  if (!password) {
    throw new Error(
      `Missing ${account.passwordVariable} in your test environment.`,
    );
  }

  if (password.length > 128) {
    throw new Error(
      `${account.passwordVariable} exceeds the login limit of 128 characters.`,
    );
  }
}

const db = postgres({
  contractJson,
  url: databaseUrl,
});

try {
  for (const account of accounts) {
    const existing = await db.orm.public.User
      .where({ email: account.email })
      .first();

    if (existing) {
      console.log(`Skipped existing account: ${account.email}`);
      continue;
    }

    const password = process.env[account.passwordVariable];

    if (!password) {
      throw new Error(`Missing ${account.passwordVariable}.`);
    }

    const passwordHash = await argon2.hash(password);

    await db.orm.public.User.create({
      email: account.email,
      passwordHash,
      firstName: account.firstName,
      lastName: account.lastName,
      role: account.role,
      isActive: account.isActive ?? true,
    });

    console.log(`Created ${account.role} E2E account: ${account.email}`);
  }

  console.log('E2E account seeding completed.');
} catch (error) {
  console.error('E2E account seeding failed:', error);
  process.exitCode = 1;
} finally {
  await db.close();
}
