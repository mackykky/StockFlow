
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export const STOCK_MOVEMENT_TYPES = [
  'OPENING_STOCK',
  'PURCHASE',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'RETURN_IN',
  'RETURN_OUT',
] as const;

export type StockMovementTypeInput =
  (typeof STOCK_MOVEMENT_TYPES)[number];

export class CreateStockMovementDto {
  @IsInt()
  @Min(1)
  productId!: number;

  @IsIn(STOCK_MOVEMENT_TYPES)
  type!: StockMovementTypeInput;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  notes?: string;
}
