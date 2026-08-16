/**
 * Returns the branch id a user is confined to, or undefined when the user
 * may see every branch (admins and owners).
 */
export function branchScope(user?: { role?: string; branchId?: number | null }): number | undefined {
  if (!user) return undefined;
  if (user.role === 'admin' || user.role === 'owner') return undefined;
  return user.branchId || undefined;
}

/**
 * Effective branch filter for a request: branch-confined staff always get
 * their own branch; admins and owners may optionally pick one via query.
 */
export function effectiveBranch(user: { role?: string; branchId?: number | null } | undefined, requested?: string | number): number | undefined {
  const scope = branchScope(user);
  if (scope) return scope;
  const isGlobal = user?.role === 'admin' || user?.role === 'owner';
  if (isGlobal && requested && +requested > 0) return +requested;
  return undefined;
}
