import { receiptForRole } from '../auth/cost-visibility.js';

import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { SalesService } from './sales.service.js';
import { CreateSaleDto } from './dto/create-sale.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles/roles.guard.js';

interface AuthenticatedRequest extends ExpressRequest {
  user: {
    id: number;
    email: string;
    role: string;
  };
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  async create(
    @Body() dto: CreateSaleDto,
    @Request() request: AuthenticatedRequest,
  ) {
    const result = await this.salesService.create(dto, request.user.id);
    return { ...result, sale: receiptForRole(result.sale, request.user.role) };
  }

  @Get()
  findAll() {
    return this.salesService.findAll();
  }

  @Get(':id')
  async findById(@Param('id', ParseIntPipe) id: number, @Request() request: AuthenticatedRequest) {
    return receiptForRole(await this.salesService.findById(id), request.user.role);
  }
}
