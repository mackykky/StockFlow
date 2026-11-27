export const movementLabels = {
  OPENING_STOCK: "Opening stock",
  PURCHASE: "Purchase",
  ADJUSTMENT_IN: "Adjustment in",
  RETURN_IN: "Return in",
  ADJUSTMENT_OUT: "Adjustment out",
  RETURN_OUT: "Return out",
  SALE: "Sale",
};
export type MovementType = keyof typeof movementLabels;
