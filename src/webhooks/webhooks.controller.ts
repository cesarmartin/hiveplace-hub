import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiHeader,
} from '@nestjs/swagger';
import { HmacGuard } from './hmac.guard';
import { IdempotencyService } from './idempotency.service';
import { webhookReceivedCounter } from '../common/metrics/metrics.controller';
import { InMemoryQueue } from '../queue/in-memory.queue';
import { NormalizationJob } from '../queue/queue.module';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly idem: IdempotencyService,
    private readonly queue: InMemoryQueue<NormalizationJob>,
  ) {}

  /**
   * Receives a webhook from a specific provider.
   *
   * Accepted providers: `pluggy`, `belvo`.
   * Payload shapes differ by provider — this endpoint only handles transport-level
   * concerns (auth, idempotency, ack). Canonicalization happens downstream in the
   * queue worker (see ADAPTERS bloc).
   */
  @Post(':provider')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(HmacGuard)
  @ApiOperation({ summary: 'Receive a webhook from a provider' })
  @ApiParam({ name: 'provider', enum: ['pluggy', 'belvo'] })
  @ApiHeader({ name: 'x-signature', description: 'sha256=<hex HMAC of raw body>' })
  @ApiResponse({ status: 202, description: 'Accepted (queued or duplicate)' })
  @ApiResponse({ status: 401, description: 'Invalid HMAC signature' })
  async receive(
    @Param('provider') provider: string,
    @Body() body: any,
  ) {
    // Extract event id — each provider uses a different field name.
    // This is intentionally naive; adapters will own real parsing.
    const eventId =
      body?.eventId ?? body?.event_id ?? body?.id ?? body?.notification_id;

    if (!eventId) {
      // Still ack to avoid provider retry storms; log for investigation.
      this.logger.warn(
        { provider, body: redactBody(body) },
        'webhook missing event id',
      );
      webhookReceivedCounter.inc({ provider, outcome: 'missing_id' });
      return { status: 'accepted', note: 'missing event id' };
    }

    const fresh = await this.idem.reserve(provider, String(eventId));

    if (!fresh) {
      webhookReceivedCounter.inc({ provider, outcome: 'duplicate' });
      this.logger.log({ provider, eventId }, 'duplicate webhook — ignored');
      return { status: 'accepted', duplicate: true };
    }

    webhookReceivedCounter.inc({ provider, outcome: 'queued' });
    this.logger.log({ provider, eventId }, 'webhook accepted');

    // Enqueue for async normalization + persistence
    const enqueued = this.queue.enqueue({
      provider,
      rawPayload: JSON.stringify(body),
      eventId: String(eventId),
    });

    if (!enqueued) {
      this.logger.error({ provider, eventId }, 'queue overflow — job rejected');
      // Release the idempotency key so provider can retry
      await this.idem.release(provider, String(eventId));
      return { status: 'accepted', note: 'queue overflow' };
    }

    return { status: 'accepted', eventId };
  }
}

// Strip obviously-sensitive fields before logging.
function redactBody(body: any): any {
  if (!body || typeof body !== 'object') return body;
  const { token, authorization, secret, ...rest } = body;
  return rest;
}