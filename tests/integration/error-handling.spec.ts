import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { HmacGuard } from '../../src/webhooks/hmac.guard';
import { createHmac } from 'crypto';

/**
 * Unit tests for error scenarios in HmacGuard.
 * These tests verify HMAC validation edge cases.
 */
describe('HmacGuard Error Handling', () => {
  let guard: HmacGuard;

  beforeEach(() => {
    guard = new HmacGuard();
    process.env.PLUGGY_WEBHOOK_SECRET = 'test-pluggy-secret';
    process.env.BELVO_WEBHOOK_SECRET = 'test-belvo-secret';
  });

  afterEach(() => {
    delete process.env.PLUGGY_WEBHOOK_SECRET;
    delete process.env.BELVO_WEBHOOK_SECRET;
  });

  function createMockContext(
    provider: string,
    rawBody: Buffer,
    signature: string,
    additionalHeaders: Record<string, string> = {},
  ) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          params: { provider },
          headers: { 'x-signature': signature, ...additionalHeaders },
          rawBody,
        }),
      }),
    } as unknown as any;
  }

  describe('Invalid HMAC signatures', () => {
    it('should reject webhook with wrong secret', () => {
      const body = Buffer.from('{"eventId":"test-1","amount":"10.00"}');
      const wrongSig = `sha256=${createHmac('sha256', 'wrong-secret').update(body).digest('hex')}`;
      const context = createMockContext('pluggy', body, wrongSig);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should reject webhook with tampered body', () => {
      const originalBody = Buffer.from('{"eventId":"test-1","amount":"10.00"}');
      const tamperedBody = Buffer.from('{"eventId":"test-2","amount":"999.00"}');
      const signature = `sha256=${createHmac('sha256', 'test-pluggy-secret').update(originalBody).digest('hex')}`;
      const context = createMockContext('pluggy', tamperedBody, signature);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should reject webhook with malformed signature (not hex)', () => {
      const body = Buffer.from('{"eventId":"test-1","amount":"10.00"}');
      const context = createMockContext('pluggy', body, 'not-a-valid-hex-signature');

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should reject webhook with empty signature', () => {
      const body = Buffer.from('{"eventId":"test-1","amount":"10.00"}');
      const context = createMockContext('pluggy', body, '');

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });

  describe('Missing authentication headers', () => {
    it('should reject request without x-signature header', () => {
      const body = Buffer.from('{"eventId":"test-1","amount":"10.00"}');
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            params: { provider: 'pluggy' },
            headers: {},
            rawBody: body,
          }),
        }),
      } as unknown as any;

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should reject request with empty x-signature header', () => {
      const body = Buffer.from('{"eventId":"test-1","amount":"10.00"}');
      const context = createMockContext('pluggy', body, '');

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });

  describe('Unknown providers', () => {
    it('should reject webhook for unrecognized provider', () => {
      const body = Buffer.from('{"eventId":"test-1"}');
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            params: { provider: 'unknown-provider' },
            headers: { 'x-signature': 'sha256=abc' },
            rawBody: body,
          }),
        }),
      } as unknown as any;

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should reject webhook when provider secret is not configured', () => {
      delete process.env.PLUGGY_WEBHOOK_SECRET;
      const body = Buffer.from('{"eventId":"test-1"}');
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            params: { provider: 'pluggy' },
            headers: { 'x-signature': 'sha256=abc' },
            rawBody: body,
          }),
        }),
      } as unknown as any;

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });

  describe('Missing raw body', () => {
    it('should reject request when rawBody is undefined', () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            params: { provider: 'pluggy' },
            headers: { 'x-signature': 'sha256=abc' },
            rawBody: undefined,
          }),
        }),
      } as unknown as any;

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should reject request when rawBody is null', () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            params: { provider: 'pluggy' },
            headers: { 'x-signature': 'sha256=abc' },
            rawBody: null,
          }),
        }),
      } as unknown as any;

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });

  describe('Signature format edge cases', () => {
    it('should handle signature without sha256= prefix', () => {
      const body = Buffer.from('{"eventId":"123"}');
      const sig = createHmac('sha256', 'test-pluggy-secret').update(body).digest('hex');
      const context = createMockContext('pluggy', body, sig);

      // Should work without the prefix
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should reject signature with wrong algorithm prefix', () => {
      const body = Buffer.from('{"eventId":"123"}');
      const wrongAlgoSig = createHmac('md5', 'test-pluggy-secret').update(body).digest('hex');
      const context = createMockContext('pluggy', body, `sha256=${wrongAlgoSig}`);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should reject signature with sha384 prefix', () => {
      const body = Buffer.from('{"eventId":"123"}');
      const sig = createHmac('sha384', 'test-pluggy-secret').update(body).digest('hex');
      const context = createMockContext('pluggy', body, `sha256=${sig}`);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });

  describe('Case sensitivity', () => {
    it('should handle uppercase provider name (case-insensitive lookup)', () => {
      const body = Buffer.from('{"eventId":"123"}');
      const secret = 'test-pluggy-secret';
      const sig = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
      const context = createMockContext('PLUGGY', body, sig);

      // Guard uses toLowerCase() so PLUGGY matches pluggy
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should handle mixed case provider name (case-insensitive lookup)', () => {
      const body = Buffer.from('{"eventId":"123"}');
      const secret = 'test-pluggy-secret';
      const sig = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
      const context = createMockContext('PluggY', body, sig);

      // Guard uses toLowerCase() so PluggY matches pluggy
      expect(guard.canActivate(context)).toBe(true);
    });
  });
});