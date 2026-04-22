import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Logger,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SyncService } from './sync.service';

@ApiTags('sync')
@Controller('sync')
export class SyncController {
  private readonly logger = new Logger(SyncController.name);

  constructor(private readonly syncService: SyncService) {}

  @Post(':accountId')
  @ApiOperation({ summary: 'Sync transactions for an account from a provider' })
  @ApiParam({ name: 'accountId', description: 'Account ID to sync transactions for' })
  @ApiQuery({
    name: 'provider',
    enum: ['pluggy', 'belvo'],
    description: 'Provider to sync from',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Sync completed' })
  @ApiResponse({ status: 400, description: 'Invalid provider' })
  @ApiResponse({ status: 502, description: 'Provider unavailable (circuit breaker open)' })
  async sync(
    @Param('accountId') accountId: string,
    @Query('provider') provider: string,
  ): Promise<{ status: string; synced: number; failed: number }> {
    if (!provider || !['pluggy', 'belvo'].includes(provider)) {
      throw new Error('Invalid provider. Must be pluggy or belvo');
    }

    this.logger.log({ accountId, provider }, 'sync request received');

    try {
      const result = await this.syncService.syncAccount(accountId, provider);
      return {
        status: 'completed',
        synced: result.synced,
        failed: result.failed,
      };
    } catch (err: any) {
      this.logger.error({ accountId, provider, error: err?.message }, 'sync failed');
      throw err;
    }
  }
}