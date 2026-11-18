
import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from './database/database.service.js';

@Controller()
export class AppController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get()
  getHello(): string {
    return 'StockFlow API is running!';
  }


  @Get('health/database')
  async checkDatabase() {
    const result = await this.databaseService.db.orm.public.User
      .where({ id: -1 })
      .first();

    return {
      status: 'ok',
      database: 'connected',
      queryExecuted: true,
      userFound: result !== null,
    };
  }

}
