
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { DatabaseService } from '../database/database.service.js';
import { JwtStrategy } from './jwt.strategy.js';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const userFirst = vi.fn();

  const mockDatabaseService = {
    db: {
      orm: {
        public: {
          User: {
            where: vi.fn(() => ({
              first: userFirst,
            })),
          },
        },
      },
    },
  };

  const mockConfigService = {
    getOrThrow: vi.fn().mockReturnValue(
      'test-only-secret-for-unit-tests-32chars',
    ),
  };

  const activeUser = {
    id: 2,
    email: 'staff.test@stockflow.local',
    role: 'STAFF',
    isActive: true,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    userFirst.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should return the authenticated user for an active account', async () => {
    userFirst.mockResolvedValueOnce(activeUser);

    await expect(
      strategy.validate({
        sub: 2,
        email: activeUser.email,
        role: activeUser.role,
      }),
    ).resolves.toEqual({
      id: 2,
      email: activeUser.email,
      role: 'STAFF',
    });
  });

  it('should reject a token for a nonexistent user', async () => {
    userFirst.mockResolvedValueOnce(null);

    await expect(
      strategy.validate({
        sub: 999,
        email: 'unknown@stockflow.local',
        role: 'STAFF',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should reject a token for an inactive account', async () => {
    userFirst.mockResolvedValueOnce({
      ...activeUser,
      isActive: false,
    });

    await expect(
      strategy.validate({
        sub: 2,
        email: activeUser.email,
        role: activeUser.role,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
