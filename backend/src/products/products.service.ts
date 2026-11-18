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

  async create(dto: CreateProductDto) {
    const sku = dto.sku.trim();
    const name = dto.name.trim();

    if (!sku || !name) {
      throw new BadRequestException('SKU and product name cannot be empty.');
    }

    const existingProduct = await this.databaseService.db.orm.public.Product
      .where({ sku })
      .first();

    if (existingProduct) {
      throw new ConflictException('A product with this SKU already exists.');
    }

    const category = await this.databaseService.db.orm.public.Category
      .where({ id: dto.categoryId })
      .first();

    if (!category || !category.isActive) {
      throw new BadRequestException(
        'The selected category does not exist or is inactive.',
      );
    }

    return this.databaseService.db.orm.public.Product.create({
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
  }

  async findAll() {
    return this.databaseService.db.orm.public.Product.where({}).all();
  }

  async findOne(id: number) {
    const product = await this.databaseService.db.orm.public.Product
      .where({ id })
      .first();

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

    if (sku && sku !== existingProduct.sku) {
      const duplicate = await this.databaseService.db.orm.public.Product
        .where({ sku })
        .first();

      if (duplicate) {
        throw new ConflictException('A product with this SKU already exists.');
      }
    }

    if (dto.categoryId !== undefined) {
      const category = await this.databaseService.db.orm.public.Category
        .where({ id: dto.categoryId })
        .first();

      if (!category || !category.isActive) {
        throw new BadRequestException(
          'The selected category does not exist or is inactive.',
        );
      }
    }

    const updatedProduct = await this.databaseService.db.orm.public.Product
      .where({ id })
      .update({
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

    if (!updatedProduct) {
      throw new NotFoundException(`Product with ID ${id} not found.`);
    }

    return updatedProduct;
  }

  async deactivate(id: number) {
    const product = await this.findOne(id);

    if (!product.isActive) {
      throw new BadRequestException('Product is already inactive.');
    }

    return this.databaseService.db.orm.public.Product
      .where({ id })
      .update({ isActive: false });
  }
}