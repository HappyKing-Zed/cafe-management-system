/**
 * Returns the branch id a user is confined to, or undefined when the user
 * may see every branch (admins and owners).
 */
export function branchScope(user?: { role?: string; branchId?: number | null }): number | undefined {
  if (!user) return undefined;
  if (user.role === 'admin' || user.role === 'owner') return undefined;
  return user.branchId || undefined;
}
