
import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  ForbiddenException,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';
import { ROLES_KEY, type UserRole } from '../../decorators/roles/roles.js';

describe('RolesGuard', () => {
  let guard: RolesGuard;

  const getAllAndOverride = vi.fn();
  const reflector = {
    getAllAndOverride,
  } as unknown as Reflector;

  const mockHandler = vi.fn();
const mockController = vi.fn();

const createContext = (user?: {
  id: number;
  email: string;
  role: string;
}): ExecutionContext =>
  ({
    getHandler: () => mockHandler,
    getClass: () => mockController,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  }) as unknown as ExecutionContext;

  beforeEach(() => {
    vi.clearAllMocks();
    getAllAndOverride.mockReset();
    guard = new RolesGuard(reflector);
  });

  it('should allow an ADMIN for an admin-only route', () => {
    getAllAndOverride.mockReturnValueOnce(['ADMIN'] satisfies UserRole[]);

    expect(
      guard.canActivate(
        createContext({
          id: 1,
          email: 'admin@stockflow.local',
          role: 'ADMIN',
        }),
      ),
    ).toBe(true);

    expect(getAllAndOverride).toHaveBeenCalledWith(
      ROLES_KEY,
      [expect.any(Function), expect.any(Function)],
    );
  });

  it('should allow a MANAGER for a manager-authorized route', () => {
    getAllAndOverride.mockReturnValueOnce([
      'ADMIN',
      'MANAGER',
    ] satisfies UserRole[]);

    expect(
      guard.canActivate(
        createContext({
          id: 2,
          email: 'manager@stockflow.local',
          role: 'MANAGER',
        }),
      ),
    ).toBe(true);
  });

  it('should deny a MANAGER on an admin-only route', () => {
    getAllAndOverride.mockReturnValueOnce(['ADMIN'] satisfies UserRole[]);

    expect(() =>
      guard.canActivate(
        createContext({
          id: 2,
          email: 'manager@stockflow.local',
          role: 'MANAGER',
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('should deny a STAFF member on a manager-authorized route', () => {
    getAllAndOverride.mockReturnValueOnce([
      'ADMIN',
      'MANAGER',
    ] satisfies UserRole[]);

    expect(() =>
      guard.canActivate(
        createContext({
          id: 3,
          email: 'staff@stockflow.local',
          role: 'STAFF',
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('should deny a request without an authenticated user when roles are required', () => {
    getAllAndOverride.mockReturnValueOnce(['ADMIN'] satisfies UserRole[]);

    expect(() => guard.canActivate(createContext())).toThrow(
      ForbiddenException,
    );
  });

  it('should allow access when no roles are required', () => {
    getAllAndOverride.mockReturnValueOnce(undefined);

    expect(
      guard.canActivate(
        createContext({
          id: 3,
          email: 'staff@stockflow.local',
          role: 'STAFF',
        }),
      ),
    ).toBe(true);
  });

  it('should allow access when the required roles list is empty', () => {
    getAllAndOverride.mockReturnValueOnce([]);

    expect(
      guard.canActivate(
        createContext({
          id: 3,
          email: 'staff@stockflow.local',
          role: 'STAFF',
        }),
      ),
    ).toBe(true);
  });
});
