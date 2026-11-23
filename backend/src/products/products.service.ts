import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

@Injectable()
export class ProductsService {
  constructor(private readonly databaseService: DatabaseService) {}

  private rethrowProductWriteError(error: unknown): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'sqlState' in error &&
      error.sqlState === '23505'
    ) {
      throw new ConflictException('A product with this SKU already exists.');
    }

    throw error;
  }

  private async findProductBySku(sku: string, excludeId?: number) {
    const normalizedSku = sku.trim().toLowerCase();

    const products = await this.databaseService.db.orm.public.Product.where(
      {},
    ).all();

    return products.find(
      (product) =>
        product.id !== excludeId &&
        product.sku.trim().toLowerCase() === normalizedSku,
    );
  }

  async create(dto: CreateProductDto) {
    const sku = dto.sku.trim();
    const name = dto.name.trim();

    if (!sku || !name) {
      throw new BadRequestException('SKU and product name cannot be empty.');
    }

    const existingProduct = await this.findProductBySku(sku);

    if (existingProduct) {
      throw new ConflictException('A product with this SKU already exists.');
    }

    try {
      return await this.databaseService.db.transaction(async (tx) => {
        const category = await tx.orm.public.Category.where({
          id: dto.categoryId,
        })
          .forUpdate()
          .first();

        if (!category || !category.isActive) {
          throw new BadRequestException(
            'The selected category does not exist or is inactive.',
          );
        }

        return await tx.orm.public.Product.create({
          sku,
          name,
          description: dto.description?.trim() || null,
          costPrice: String(dto.costPrice),
          sellingPrice: String(dto.sellingPrice),
          categoryId: dto.categoryId,
          ...(dto.reorderLevel !== undefined
            ? { reorderLevel: dto.reorderLevel }
            : {}),
        });
      });
    } catch (error: unknown) {
      this.rethrowProductWriteError(error);
    }
  }

  async findAll() {
    return this.databaseService.db.orm.public.Product.where({}).all();
  }

  async findOne(id: number) {
    const product = await this.databaseService.db.orm.public.Product.where({
      id,
    }).first();

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found.`);
    }

    return product;
  }

  async update(id: number, dto: UpdateProductDto) {
    const existingProduct = await this.findOne(id);

    const sku = dto.sku?.trim();
    const name = dto.name?.trim();

    if (sku !== undefined && !sku) {
      throw new BadRequestException('SKU cannot be empty.');
    }

    if (name !== undefined && !name) {
      throw new BadRequestException('Product name cannot be empty.');
    }

    if (sku !== undefined) {
      const duplicate = await this.findProductBySku(sku, id);

      if (duplicate) {
        throw new ConflictException('A product with this SKU already exists.');
      }
    }

    let updatedProduct;
    try {
      updatedProduct = await this.databaseService.db.transaction(async (tx) => {
        if (dto.categoryId !== undefined) {
          const category = await tx.orm.public.Category.where({
            id: dto.categoryId,
          })
            .forUpdate()
            .first();

          if (!category || !category.isActive) {
            throw new BadRequestException(
              'The selected category does not exist or is inactive.',
            );
          }
        }

        return await tx.orm.public.Product.where({
          id,
        }).update({
          ...(sku !== undefined ? { sku } : {}),
          ...(name !== undefined ? { name } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description.trim() || null }
            : {}),
          ...(dto.costPrice !== undefined
            ? { costPrice: String(dto.costPrice) }
            : {}),
          ...(dto.sellingPrice !== undefined
            ? { sellingPrice: String(dto.sellingPrice) }
            : {}),
          ...(dto.categoryId !== undefined
            ? { categoryId: dto.categoryId }
            : {}),
          ...(dto.reorderLevel !== undefined
            ? { reorderLevel: dto.reorderLevel }
            : {}),
        });
      });
    } catch (error: unknown) {
      this.rethrowProductWriteError(error);
    }

    if (!updatedProduct) {
      throw new NotFoundException(`Product with ID ${id} not found.`);
    }

    return updatedProduct;
  }

  deactivate(id: number) {
    return this.changeStatus(id, 'deactivate');
  }

  activate(id: number) {
    return this.changeStatus(id, 'activate');
  }

  archive(id: number) {
    return this.changeStatus(id, 'archive');
  }

  restore(id: number) {
    return this.changeStatus(id, 'restore');
  }

  private changeStatus(id: number, action: 'activate' | 'deactivate' | 'archive' | 'restore') {
    return this.databaseService.db.transaction(async (tx) => {
      const product = await tx.orm.public.Product.where({ id }).forUpdate().first();
      if (!product) throw new NotFoundException('Product not found.');
      const archived = !product.isActive && !product.isSuspended;
      switch (action) {
        case 'deactivate':
          if (!product.isActive) throw new BadRequestException('Only active products can be deactivated.');
          break;
        case 'activate': {
          if (archived) throw new ConflictException('Restore the archived product before activating it.');
          if (product.isActive) throw new BadRequestException('Product is already active.');
          const category = await tx.orm.public.Category.where({ id: product.categoryId }).forUpdate().first();
          if (!category?.isActive) throw new ConflictException('Assign an active category before activating this product.');
          break;
        }
        case 'archive':
          if (archived) throw new BadRequestException('Product is already archived.');
          if (product.stockQuantity !== 0) throw new ConflictException('Stock must be zero before archiving this product.');
          break;
        case 'restore':
          if (!archived) throw new BadRequestException('Only archived products can be restored.');
          break;
      }
      return tx.orm.public.Product.where({ id }).update({
        isActive: action === 'activate',
        isSuspended: action === 'deactivate' || action === 'restore',
      });
    });
  }
}
