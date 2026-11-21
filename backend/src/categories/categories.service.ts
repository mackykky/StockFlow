import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly databaseService: DatabaseService) {}

  private rethrowCategoryWriteError(error: unknown): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'sqlState' in error &&
      error.sqlState === '23505'
    ) {
      throw new ConflictException('A category with this name already exists.');
    }

    throw error;
  }

  private async findCategoryByName(name: string, excludeId?: number) {
    const normalizedName = name.trim().toLowerCase();

    const categories = await this.databaseService.db.orm.public.Category.where(
      {},
    ).all();

    return categories.find(
      (category) =>
        category.id !== excludeId &&
        category.name.trim().toLowerCase() === normalizedName,
    );
  }

  async create(createCategoryDto: CreateCategoryDto) {
    const name = createCategoryDto.name.trim();

    if (!name) {
      throw new ConflictException('Category name cannot be empty.');
    }

    const existingCategory = await this.findCategoryByName(name);

    if (existingCategory) {
      throw new ConflictException('A category with this name already exists.');
    }

    try {
      return await this.databaseService.db.orm.public.Category.create({
        name,
        description: createCategoryDto.description?.trim() || null,
      });
    } catch (error) {
      this.rethrowCategoryWriteError(error);
    }
  }
  async findAll() {
    return this.databaseService.db.orm.public.Category.where({}).all();
  }
  async findOne(id: number) {
    const category = await this.databaseService.db.orm.public.Category.where({
      id,
    }).first();

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found.`);
    }

    return category;
  }

  async update(id: number, updateCategoryDto: UpdateCategoryDto) {
    await this.findOne(id);

    const name = updateCategoryDto.name?.trim();
    const description = updateCategoryDto.description?.trim();

    if (name !== undefined && !name) {
      throw new BadRequestException('Category name cannot be empty.');
    }

    if (name !== undefined) {
      const duplicate = await this.findCategoryByName(name, id);

      if (duplicate) {
        throw new ConflictException(
          'A category with this name already exists.',
        );
      }
    }

    let updatedCategory;

    try {
      updatedCategory = await this.databaseService.db.orm.public.Category.where(
        { id },
      ).update({
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined
          ? { description: description || null }
          : {}),
      });
    } catch (error) {
      this.rethrowCategoryWriteError(error);
    }

    if (!updatedCategory) {
      throw new NotFoundException(`Category with ID ${id} not found.`);
    }

    return updatedCategory;
  }

  async deactivate(id: number) {
    const category = await this.findOne(id);

    if (!category.isActive) {
      throw new BadRequestException('Category is already inactive.');
    }

    return this.databaseService.db.orm.public.Category.where({ id }).update({
      isActive: false,
    });
  }

  async activate(id: number) {
    const category = await this.findOne(id);

    if (category.isActive) {
      throw new BadRequestException('Category is already active.');
    }

    return this.databaseService.db.orm.public.Category.where({ id }).update({
      isActive: true,
    });
  }
}
