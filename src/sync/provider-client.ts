import axios, { AxiosInstance, AxiosError } from 'axios';

/**
 * Configuration for the ProviderClient.
 */
export interface ProviderClientConfig {
  baseUrl: string;
  timeout?: number;
  retries?: number;
  retryDelayMs?: number;
}

/**
 * Base provider client with common HTTP functionality:
 * - Axios instance with timeout
 * - Automatic retry with jitter on failure
 * - Configurable retry parameters per provider
 */
export abstract class ProviderClient {
  protected readonly httpClient: AxiosInstance;
  protected readonly retries: number;
  protected readonly retryDelayMs: number;

  constructor(config: ProviderClientConfig) {
    this.retries = config.retries ?? 3;
    this.retryDelayMs = config.retryDelayMs ?? 1000;

    this.httpClient = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout ?? 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Execute a request with automatic retry and jitter.
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        return await operation();
      } catch (err: any) {
        lastError = err;

        // Don't retry on last attempt
        if (attempt >= this.retries) {
          break;
        }

        // Calculate delay with jitter (exponential backoff + random)
        const jitter = Math.random() * 0.3 * this.retryDelayMs;
        const delay = Math.min(
          this.retryDelayMs * Math.pow(2, attempt) + jitter,
          30000,
        );

        console.warn(
          `[${this.providerName}] ${operationName} failed (attempt ${attempt + 1}/${this.retries + 1}): ${err?.message}. Retrying in ${Math.round(delay)}ms...`,
        );

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Get the provider name. Subclasses must implement this.
   */
  protected abstract get providerName(): string;

  /**
   * Fetch transactions for a specific account.
   * Subclasses must implement this to provider-specific API.
   */
  abstract fetchTransactions(accountId: string): Promise<any[]>;

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}