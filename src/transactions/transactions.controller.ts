import {
  Controller,
  Get,
  Param,
  Query,
  Logger,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { ListTransactionsDto } from './list-transactions.dto';

@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  private readonly logger = new Logger(TransactionsController.name);

  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'List transactions with optional filters and cursor pagination' })
  @ApiResponse({ status: 200, description: 'List of transactions' })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  async list(@Query() query: ListTransactionsDto): Promise<{
    data: any[];
    nextCursor: string | null;
    total: number;
  }> {
    return this.transactionsService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single transaction by ID' })
  @ApiParam({ name: 'id', description: 'Transaction ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Transaction details' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async getOne(@Param('id') id: string): Promise<any> {
    return this.transactionsService.getOne(id);
  }
}