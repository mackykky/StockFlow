import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { db } from '../prisma/db.js';

@Injectable()
export class DatabaseService
  implements OnModuleInit, OnApplicationShutdown
{
  readonly db = db;

  constructor(
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const databaseUrl =
      this.configService.getOrThrow<string>('DATABASE_URL');

    await this.db.connect({
      url: databaseUrl,
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.db.close();
  }
}
