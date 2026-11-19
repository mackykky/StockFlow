export interface Product {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  categoryId: number;
  costPrice: string | number;
  sellingPrice: string | number;
  stockQuantity: number;
  reorderLevel: number;
  isActive: boolean;
}
