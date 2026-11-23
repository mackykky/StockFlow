import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles/roles.guard.js';
import { Roles } from '../auth/decorators/roles/roles.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
  ) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(id, updateProductDto);
  }

  @Patch(':id/deactivate')
  @Roles('ADMIN')
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.deactivate(id);
  }

  @Patch(':id/activate')
  @Roles('ADMIN')
  activate(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.activate(id);
  }

  @Patch(':id/archive')
  @Roles('ADMIN')
  archive(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.archive(id);
  }

  @Patch(':id/restore')
  @Roles('ADMIN')
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.restore(id);
  }
}
