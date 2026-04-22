import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { WebhooksModule } from './webhooks/webhooks.module';
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
  ],
  controllers: [HealthController, MetricsController],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
