import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { register, collectDefaultMetrics, Counter } from 'prom-client';

// Initialize default node/process metrics once.
collectDefaultMetrics();

// Domain counters exported so other modules can import and increment.
export const webhookReceivedCounter = new Counter({
  name: 'webhooks_received_total',
  help: 'Total number of webhooks received',
  labelNames: ['provider', 'outcome'] as const,
});

export const transactionsPersistedCounter = new Counter({
  name: 'transactions_persisted_total',
  help: 'Total number of canonical transactions persisted',
  labelNames: ['provider'] as const,
});

@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  @Get()
  @Header('Content-Type', register.contentType)
  async scrape(): Promise<string> {
    return register.metrics();
  }
}
