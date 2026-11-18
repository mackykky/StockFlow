
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { ProductsModule } from './products/products.module.js';
import { StockMovementsModule } from './stock-movements/stock-movements.module.js';
import { SalesModule } from './sales/sales.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { AuthModule } from './auth/auth.module.js';

function validateEnvironment(config: Record<string, unknown>) {
  const errors: string[] = [];

  const databaseUrl = config['DATABASE_URL'];
  const jwtSecret = config['JWT_SECRET'];
  const port = config['PORT'];
  const corsOrigin = config['CORS_ORIGIN'];

  if (typeof databaseUrl !== 'string' || !databaseUrl.trim()) {
    errors.push('DATABASE_URL is required.');
  } else {
    try {
      const parsed = new URL(databaseUrl);

      if (
        parsed.protocol !== 'postgresql:' &&
        parsed.protocol !== 'postgres:'
      ) {
        errors.push('DATABASE_URL must use PostgreSQL.');
      }
    } catch {
      errors.push('DATABASE_URL must be a valid connection URL.');
    }
  }

  if (
  typeof jwtSecret !== 'string' ||
  jwtSecret.trim().length < 32
) {
  errors.push('JWT_SECRET must be at least 32 non-whitespace characters long.');
}

  if (port !== undefined) {
    const parsedPort = Number(port);

    if (
      !Number.isInteger(parsedPort) ||
      parsedPort < 1 ||
      parsedPort > 65535
    ) {
      errors.push('PORT must be an integer between 1 and 65535.');
    }
  }

  if (corsOrigin !== undefined && corsOrigin !== '') {
    if (typeof corsOrigin !== 'string') {
      errors.push('CORS_ORIGIN must be a comma-separated string of origins.');
    } else {
      const origins = corsOrigin.split(',').map((origin) => origin.trim());

      for (const origin of origins) {
        try {
          const parsed = new URL(origin);

          if (
            !['http:', 'https:'].includes(parsed.protocol) ||
            parsed.origin !== origin
          ) {
            errors.push(`Invalid CORS origin: ${origin}`);
          }
        } catch {
          errors.push(`Invalid CORS origin: ${origin}`);
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Environment configuration validation failed:\n- ${errors.join('\n- ')}`,
    );
  }

  return config;
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    DatabaseModule,
    CategoriesModule,
    ProductsModule,
    StockMovementsModule,
    SalesModule,
    ReportsModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
