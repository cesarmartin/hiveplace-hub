import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

export interface QueueJob<T = any> {
  id: string;
  data: T;
  createdAt: Date;
  attempts: number;
}

export type JobHandler<T> = (job: QueueJob<T>) => Promise<void>;

interface QueueOptions {
  maxSize?: number;
  maxRetries?: number;
}

const DEFAULT_MAX_SIZE = 1000;
const DEFAULT_MAX_RETRIES = 3;

/**
 * In-memory queue with bounded size and single-worker consumer loop.
 *
 * Design decisions:
 * - Bounded size with overflow rejection (keeps memory predictable)
 * - Single worker loop (simplifies concurrency; each job runs to completion)
 * - Retry support with configurable max attempts
 * - Job removal only on success; failed jobs after max retries are logged and dropped
 *
 * Trade-off: in-flight events are lost if the process crashes. Mitigated by
 * idempotency keys already reserved before enqueueing - providers can retry.
 */
@Injectable()
export class InMemoryQueue<T = unknown> implements OnModuleDestroy {
  private readonly logger = new Logger(InMemoryQueue.name);
  private readonly maxSize: number;
  private readonly maxRetries: number;
  private readonly jobs: QueueJob<T>[] = [];
  private readonly handlers: Set<JobHandler<T>> = new Set();
  private running = false;
  private workerTimeout: ReturnType<typeof setTimeout> | null = null;
  private counter = 0;

  constructor(options: QueueOptions = {}) {
    this.maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  /**
   * Enqueue a job. Returns false if queue is at capacity.
   */
  enqueue(data: T): boolean {
    if (this.jobs.length >= this.maxSize) {
      this.logger.warn({ queueSize: this.jobs.length }, 'queue overflow — job rejected');
      return false;
    }

    const job: QueueJob<T> = {
      id: `job-${++this.counter}-${Date.now()}`,
      data,
      createdAt: new Date(),
      attempts: 0,
    };

    this.jobs.push(job);
    this.logger.debug({ jobId: job.id, queueSize: this.jobs.length }, 'job enqueued');
    this.scheduleWorker();
    return true;
  }

  /**
   * Register a handler to process jobs.
   * Only one handler is active at a time (single-worker model).
   */
  registerHandler(handler: JobHandler<T>): void {
    this.handlers.add(handler);
  }

  /**
   * Unregister a handler.
   */
  unregisterHandler(handler: JobHandler<T>): void {
    this.handlers.delete(handler);
  }

  /**
   * Start the worker loop. Called automatically on enqueue.
   * Can be called manually to start processing before first enqueue.
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.scheduleWorker();
  }

  /**
   * Stop the worker loop gracefully.
   */
  async stop(): Promise<void> {
    this.running = false;
    if (this.workerTimeout) {
      clearTimeout(this.workerTimeout);
      this.workerTimeout = null;
    }
    this.logger.log('queue worker stopped');
  }

  /**
   * Get current queue depth.
   */
  get depth(): number {
    return this.jobs.length;
  }

  private scheduleWorker(): void {
    if (!this.running || this.workerTimeout) return;
    this.workerTimeout = setTimeout(() => this.processNext(), 0);
  }

  private async processNext(): Promise<void> {
    this.workerTimeout = null;
    if (!this.running || this.jobs.length === 0) return;

    const job = this.jobs.shift()!;
    this.logger.debug({ jobId: job.id, attempts: job.attempts }, 'processing job');

    for (const handler of this.handlers) {
      try {
        job.attempts++;
        await handler(job);
        this.logger.debug({ jobId: job.id }, 'job completed successfully');
        break; // Job succeeded, no need to try other handlers
      } catch (err: any) {
        this.logger.warn(
          { jobId: job.id, attempt: job.attempts, error: err?.message },
          'job handler failed',
        );

        if (job.attempts >= this.maxRetries) {
          this.logger.error({ jobId: job.id, attempts: job.attempts }, 'job exceeded max retries — dropping');
          break;
        }

        // Re-enqueue for retry with delay (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, job.attempts - 1), 30000);
        setTimeout(() => {
          if (this.running && this.jobs.length < this.maxSize) {
            this.jobs.push(job);
            this.scheduleWorker();
          }
        }, delay);
        break;
      }
    }

    // Continue processing if there are more jobs
    if (this.running && this.jobs.length > 0) {
      this.scheduleWorker();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.stop();
  }
}