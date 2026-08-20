export function assignDefined<T extends object>(
  target: T,
  source: Partial<T>,
  allowedFields: readonly (keyof T)[],
): T {
  for (const field of allowedFields) {
    const value = source[field];
    if (value !== undefined) {
      (target as any)[field] = value;
    }
  }
  return target;
}