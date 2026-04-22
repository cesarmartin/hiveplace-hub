import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { AdapterRegistry } from '../webhooks/adapters/adapter.registry';
import { PrismaService } from '../common/prisma.service';

@Module({
  imports: [ConfigModule],
  controllers: [SyncController],
  providers: [
    SyncService,
    AdapterRegistry,
    PrismaService,
  ],
  exports: [SyncService],
})
export class SyncModule {}