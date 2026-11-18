
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

import { DatabaseService } from '../database/database.service.js';
import { AuthService } from './auth.service.js';

vi.mock('argon2', () => ({
  verify: vi.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;

  const userFirst = vi.fn();
  const signAsync = vi.fn();

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

  const activeUser = {
    id: 2,
    email: 'staff.test@stockflow.local',
    passwordHash: 'hashed-password',
    firstName: 'Test',
    lastName: 'Staff',
    role: 'STAFF',
    isActive: true,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    userFirst.mockReset();
    signAsync.mockReset();
    vi.mocked(argon2.verify).mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: JwtService,
          useValue: {
            signAsync,
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should log in successfully and return an access token', async () => {
    userFirst.mockResolvedValueOnce(activeUser);
    vi.mocked(argon2.verify).mockResolvedValueOnce(true);
    signAsync.mockResolvedValueOnce('test-access-token');

    const result = await service.login({
      email: '  STAFF.TEST@STOCKFLOW.LOCAL  ',
      password: 'StaffTest-2026!',
    });

    expect(vi.mocked(argon2.verify)).toHaveBeenCalledWith(
      'hashed-password',
      'StaffTest-2026!',
    );

    expect(signAsync).toHaveBeenCalledWith({
      sub: 2,
      email: 'staff.test@stockflow.local',
      role: 'STAFF',
    });

    expect(result).toEqual({
      accessToken: 'test-access-token',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: {
        id: 2,
        email: 'staff.test@stockflow.local',
        firstName: 'Test',
        lastName: 'Staff',
        role: 'STAFF',
      },
    });
  });

  it('should reject an unknown email', async () => {
    userFirst.mockResolvedValueOnce(null);

    await expect(
      service.login({
        email: 'unknown@stockflow.local',
        password: 'SomePassword123!',
      }),
    ).rejects.toThrow(UnauthorizedException);

    expect(vi.mocked(argon2.verify)).not.toHaveBeenCalled();
    expect(signAsync).not.toHaveBeenCalled();
  });

  it('should reject an incorrect password', async () => {
    userFirst.mockResolvedValueOnce(activeUser);
    vi.mocked(argon2.verify).mockResolvedValueOnce(false);

    await expect(
      service.login({
        email: activeUser.email,
        password: 'WrongPassword123!',
      }),
    ).rejects.toThrow(UnauthorizedException);

    expect(signAsync).not.toHaveBeenCalled();
  });

  it('should reject an inactive account', async () => {
    userFirst.mockResolvedValueOnce({
      ...activeUser,
      isActive: false,
    });

    await expect(
      service.login({
        email: activeUser.email,
        password: 'StaffTest-2026!',
      }),
    ).rejects.toThrow(UnauthorizedException);

    expect(vi.mocked(argon2.verify)).not.toHaveBeenCalled();
    expect(signAsync).not.toHaveBeenCalled();
  });
});
