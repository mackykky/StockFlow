
import type { ReactNode } from 'react';
import { useAuth } from './useAuth';
import { hasPermission, type Permission } from './permissions';

interface CanProps {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}

export default function Can({
  permission,
  children,
  fallback = null,
}: CanProps) {
  const { user } = useAuth();

  if (!hasPermission(user?.role, permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
