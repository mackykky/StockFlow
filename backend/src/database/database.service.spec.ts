
import { DatabaseService } from './database.service.js';
import { db } from '../prisma/db.js';

describe('DatabaseService', () => {
  let service: DatabaseService;

  beforeEach(() => {
    service = new DatabaseService();
  });

  it('should close the database client during application shutdown', async () => {
    const closeSpy = vi.spyOn(db, 'close').mockResolvedValue(undefined);

    await service.onApplicationShutdown();

    expect(closeSpy).toHaveBeenCalledTimes(1);

    closeSpy.mockRestore();
  });
});
