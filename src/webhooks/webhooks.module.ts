import { Module, forwardRef } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { IdempotencyService } from './idempotency.service';
import { HmacGuard } from './hmac.guard';
import { PluggyAdapter } from './adapters/pluggy.adapter';
import { BelvoAdapter } from './adapters/belvo.adapter';
import { PrismaService } from '../common/prisma.service';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [QueueModule],
  controllers: [WebhooksController],
  providers: [
    IdempotencyService,
    HmacGuard,
    PluggyAdapter,
    BelvoAdapter,
    PrismaService,
  ],
  exports: [PluggyAdapter, BelvoAdapter, IdempotencyService],
})
export class WebhooksModule {}