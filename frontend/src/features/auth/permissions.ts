
import type { UserRole } from './auth.types';

export type Permission =
  | 'products:read'
  | 'products:create'
  | 'inventory:read'
  | 'inventory:manage'
  | 'sales:create'
  | 'reports:read'
  | 'reports:cost';

const rolePermissions: Record<UserRole, readonly Permission[]> = {
  ADMIN: [
    'products:read',
    'products:create',
    'inventory:read',
    'inventory:manage',
    'sales:create',
    'reports:read',
    'reports:cost',
  ],

  MANAGER: [
    'products:read',
    'products:create',
    'inventory:read',
    'inventory:manage',
    'sales:create',
    'reports:read',
    'reports:cost',
  ],

  STAFF: [
    'products:read',
    'inventory:read',
    'sales:create',
    'reports:read',
  ],
};

export function hasPermission(
  role: UserRole | undefined,
  permission: Permission,
): boolean {
  if (!role) return false;

  return rolePermissions[role].includes(permission);
}
