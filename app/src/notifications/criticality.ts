export function getCriticality(
  daysUntilExpiry: number,
): 'expired' | 'critical' | 'urgent' | 'warning' | 'normal' {
  if (daysUntilExpiry <= 0) return 'expired';
  if (daysUntilExpiry <= 1) return 'critical';
  if (daysUntilExpiry <= 3) return 'urgent';
  if (daysUntilExpiry <= 7) return 'warning';
  return 'normal';
}
