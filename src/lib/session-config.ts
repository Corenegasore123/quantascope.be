/** Maximum authenticated session lifetime (default 7 hours). */
export function sessionMaxAgeMs(): number {
  const hours = parseInt(process.env.SESSION_MAX_AGE_HOURS ?? "7", 10);
  return Math.max(1, hours) * 60 * 60 * 1000;
}

export function sessionMaxAgeHours(): number {
  return Math.max(1, parseInt(process.env.SESSION_MAX_AGE_HOURS ?? "7", 10));
}
