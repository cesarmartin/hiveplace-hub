import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { WebhooksModule } from './webhooks/webhooks.module';
import { QueueModule } from './queue/queue.module';
import { SyncModule } from './sync/sync.module';
import { TransactionsModule } from './transactions/transactions.module';
import { HealthController } from './common/health.controller';
import { MetricsController } from './common/metrics/metrics.controller';
import { PrismaService } from './common/prisma.service';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        // Redact common sensitive headers so webhook payloads never leak into logs
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers["x-api-key"]',
            'req.headers["x-signature"]',
            'req.headers["x-hub-signature-256"]',
          ],
          censor: '[REDACTED]',
        },
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),
    WebhooksModule,
    QueueModule,
    SyncModule,
    TransactionsModule,
  ],
  controllers: [HealthController, MetricsController],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}