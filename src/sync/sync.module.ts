import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { AdapterRegistry } from '../webhooks/adapters/adapter.registry';
import { PrismaService } from '../common/prisma.service';

@Module({
  controllers: [SyncController],
  providers: [
    SyncService,
    AdapterRegistry,
    PrismaService,
  ],
  exports: [SyncService],
})
export class SyncModule {}