
import {
  Injectable,
  OnApplicationShutdown,
} from '@nestjs/common';
import { db } from '../prisma/db.js';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  readonly db = db;

  async onApplicationShutdown(): Promise<void> {
    await this.db.close();
  }
}
