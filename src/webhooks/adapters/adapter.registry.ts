/**
 * Adapter registry - resolves provider name to adapter instance.
 *
 * Used by the queue worker to pick the correct adapter for normalization.
 */
import { ProviderAdapter } from './provider-adapter.interface';
import { PluggyAdapter } from './pluggy.adapter';
import { BelvoAdapter } from './belvo.adapter';

export class AdapterRegistry {
  private readonly adapters: Map<string, ProviderAdapter>;

  constructor() {
    this.adapters = new Map();
    // Register known adapters
    this.register(new PluggyAdapter());
    this.register(new BelvoAdapter());
  }

  /**
   * Register an adapter for a specific provider.
   */
  register(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }

  /**
   * Get the adapter for a given provider name.
   * Returns undefined if no adapter is registered for the provider.
   */
  getAdapter(provider: string): ProviderAdapter | undefined {
    return this.adapters.get(provider);
  }

  /**
   * Check if an adapter exists for the given provider.
   */
  hasAdapter(provider: string): boolean {
    return this.adapters.has(provider);
  }

  /**
   * Get all registered provider names.
   */
  getProviders(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Auto-detect which adapter can handle a payload by trying each registered adapter.
   * Returns the first adapter that can handle the payload, or undefined if none match.
   */
  detectAdapter(payload: unknown): ProviderAdapter | undefined {
    for (const adapter of this.adapters.values()) {
      if (adapter.canHandle(payload)) {
        return adapter;
      }
    }
    return undefined;
  }
}