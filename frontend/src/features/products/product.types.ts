export interface Product {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  categoryId: number;
  costPrice?: string | number;
  sellingPrice: string | number;
  stockQuantity: number;
  reorderLevel: number;
  isSuspended: boolean;
  isActive: boolean;
}

export function productStatus(product: Product) {
  if (product.isActive) return "Active";
  return product.isSuspended ? "Inactive" : "Archived";
}
