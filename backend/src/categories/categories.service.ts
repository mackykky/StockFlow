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

  async create(createCategoryDto: CreateCategoryDto) {
    const name = createCategoryDto.name.trim();

    if (!name) {
      throw new ConflictException('Category name cannot be empty.');
    }

    const existingCategory = await this.databaseService.db.orm.public.Category
      .where({ name })
      .first();

    if (existingCategory) {
      throw new ConflictException('A category with this name already exists.');
    }

    return this.databaseService.db.orm.public.Category.create({
      name,
      description: createCategoryDto.description?.trim() || null,
    });
  }
  async findAll() {
  return this.databaseService.db.orm.public.Category
    .where({})
    .all();
}
async findOne(id: number) {
  const category = await this.databaseService.db.orm.public.Category
    .where({ id })
    .first();

  if (!category) {
    throw new NotFoundException(`Category with ID ${id} not found.`);
  }

  return category;
}


async update(id: number, updateCategoryDto: UpdateCategoryDto) {
  const existingCategory = await this.findOne(id);

  const name = updateCategoryDto.name?.trim();
  const description = updateCategoryDto.description?.trim();

  if (name !== undefined && !name) {
    throw new BadRequestException(
      'Category name cannot be empty.',
    );
  }

  if (name && name !== existingCategory.name) {
    const duplicate = await this.databaseService.db.orm.public.Category
      .where({ name })
      .first();

    if (duplicate) {
      throw new ConflictException(
        'A category with this name already exists.',
      );
    }
  }

  const updatedCategory = await this.databaseService.db.orm.public.Category
    .where({ id })
    .update({
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined
        ? { description: description || null }
        : {}),
    });

  if (!updatedCategory) {
    throw new NotFoundException(`Category with ID ${id} not found.`);
  }

  return updatedCategory;
}

async deactivate(id: number) {
  const category = await this.findOne(id);

  if (!category.isActive) {
    throw new BadRequestException(
      'Category is already inactive.',
    );
  }

  return this.databaseService.db.orm.public.Category
    .where({ id })
    .update({ isActive: false });
}

}