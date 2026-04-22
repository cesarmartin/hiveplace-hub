import { Counter, Gauge } from 'prom-client';
import CircuitBreaker from 'opossum';

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Circuit breaker metrics for observability.
 * Emitted on state transitions to help monitor provider health.
 */
export const circuitBreakerStateGauge = new Gauge({
  name: 'circuit_breaker_state',
  help: 'Circuit breaker state per provider (0=CLOSED, 1=OPEN, 2=HALF_OPEN)',
  labelNames: ['provider'] as const,
});

/**
 * Wrapper around opossum CircuitBreaker that adds metrics.
 */
export class CircuitBreakerWrapper {
  private readonly breaker: CircuitBreaker;
  private readonly provider: string;

  constructor(
    provider: string,
    options: {
      timeout?: number;
      resetTimeout?: number;
      errorThresholdPercentage?: number;
      volumeThreshold?: number;
    } = {},
  ) {
    this.provider = provider;
    this.breaker = new CircuitBreaker(this.fire.bind(this), {
      timeout: options.timeout ?? 10000, // If function takes > 10s, trigger failure
      resetTimeout: options.resetTimeout ?? 30000, // Try to reopen after 30s
      errorThresholdPercentage: options.errorThresholdPercentage ?? 50, // Open if >50% failures
      volumeThreshold: options.volumeThreshold ?? 10, // Need at least 10 requests to calculate %
    });

    this.breaker.on('open', () => {
      console.log(`[CircuitBreaker] ${provider} OPEN`);
      circuitBreakerStateGauge.labels(provider).set(1);
    });

    this.breaker.on('halfOpen', () => {
      console.log(`[CircuitBreaker] ${provider} HALF_OPEN`);
      circuitBreakerStateGauge.labels(provider).set(2);
    });

    this.breaker.on('close', () => {
      console.log(`[CircuitBreaker] ${provider} CLOSED`);
      circuitBreakerStateGauge.labels(provider).set(0);
    });

    // Initialize gauge to CLOSED state
    circuitBreakerStateGauge.labels(provider).set(0);
  }

  /**
   * Execute a function through the circuit breaker.
   */
  async fire<T>(fn: () => Promise<T>): Promise<T> {
    return this.breaker.fire(fn);
  }

  /**
   * Get the current state of the circuit breaker.
   */
  get currentState(): CircuitBreakerState {
    if (this.breaker.status.stats.failures > 0 && this.breaker.status.stats.isOpen) {
      return 'OPEN';
    }
    if (this.breaker.status.stats.isHalfOpen) {
      return 'HALF_OPEN';
    }
    return 'CLOSED';
  }

  /**
   * Get breaker stats for testing/debugging.
   */
  get stats() {
    return {
      failures: this.breaker.status.stats.failures,
      successes: this.breaker.status.stats.successes,
      rejects: this.breaker.status.stats.rejects,
      isOpen: this.breaker.status.stats.isOpen,
      isHalfOpen: this.breaker.status.stats.isHalfOpen,
    };
  }
}