/** Raw cost fields are reserved for cost-report roles on authenticated read and checkout responses. */
export function canViewCosts(role: string) {
  return role === 'ADMIN' || role === 'MANAGER';
}

export function productForRole<T extends { costPrice: unknown }>(product: T, role: string) {
  if (canViewCosts(role)) return product;
  const { costPrice: _costPrice, ...visible } = product;
  return visible;
}

export function receiptForRole<T extends { items: { unitCost: unknown }[] }>(sale: T, role: string) {
  if (canViewCosts(role)) return sale;
  return { ...sale, items: sale.items.map(({ unitCost: _unitCost, ...item }) => item) };
}
