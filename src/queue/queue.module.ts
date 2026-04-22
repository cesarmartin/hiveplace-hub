import { Module, OnModuleInit } from '@nestjs/common';
import { InMemoryQueue } from './in-memory.queue';
import { AdapterRegistry } from '../webhooks/adapters/adapter.registry';
import { PrismaService } from '../common/prisma.service';
import { QueueWorkerService } from './queue-worker.service';
import { IdempotencyService } from '../webhooks/idempotency.service';

export const QUEUE_JOB_SYMBOL = Symbol('QUEUE_JOB');

export interface NormalizationJob {
  provider: string;
  rawPayload: string;
  eventId: string;
}

const queueInstance = new InMemoryQueue<NormalizationJob>({
  maxSize: Number(process.env.QUEUE_MAX_SIZE ?? 1000),
  maxRetries: Number(process.env.QUEUE_MAX_RETRIES ?? 3),
});

@Module({
  providers: [
    { provide: InMemoryQueue, useValue: queueInstance },
    AdapterRegistry,
    QueueWorkerService,
    PrismaService,
    IdempotencyService,
  ],
  exports: [InMemoryQueue, AdapterRegistry, IdempotencyService],
})
export class QueueModule implements OnModuleInit {
  onModuleInit() {
    queueInstance.start();
  }
}