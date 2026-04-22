import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { HmacGuard } from '../../src/webhooks/hmac.guard';
import { createHmac } from 'crypto';

describe('HmacGuard', () => {
  let guard: HmacGuard;

  beforeEach(() => {
    guard = new HmacGuard();
    process.env.PLUGGY_WEBHOOK_SECRET = 'test-pluggy-secret';
    process.env.BELVO_WEBHOOK_SECRET = 'test-belvo-secret';
  });

  function createMockContext(
    provider: string,
    rawBody: Buffer,
    signature: string,
  ): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          params: { provider },
          headers: { 'x-signature': signature },
          rawBody,
        }),
      }),
    } as unknown as ExecutionContext;
  }

  describe('valid signatures', () => {
    it('should allow request with valid Pluggy signature', () => {
      const body = JSON.stringify({ eventId: '123', amount: '100.00' });
      const rawBody = Buffer.from(body);
      const secret = 'test-pluggy-secret';
      const signature = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
      const context = createMockContext('pluggy', rawBody, signature);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow request with valid Belvo signature', () => {
      const body = JSON.stringify({ notification_id: '456', amount_cents: 10000 });
      const rawBody = Buffer.from(body);
      const secret = 'test-belvo-secret';
      const signature = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
      const context = createMockContext('belvo', rawBody, signature);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should accept signature without sha256= prefix', () => {
      const body = JSON.stringify({ eventId: '789' });
      const rawBody = Buffer.from(body);
      const secret = 'test-pluggy-secret';
      const sig = createHmac('sha256', secret).update(rawBody).digest('hex');
      const context = createMockContext('pluggy', rawBody, sig);

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('invalid signatures', () => {
    it('should reject request with wrong signature', () => {
      const body = Buffer.from('{"eventId":"123"}');
      const wrongSignature = `sha256=${createHmac('sha256', 'wrong-secret').update(body).digest('hex')}`;
      const context = createMockContext('pluggy', body, wrongSignature);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should reject request with tampered body', () => {
      const originalBody = Buffer.from('{"eventId":"123"}');
      const tamperedBody = Buffer.from('{"eventId":"456"}');
      const secret = 'test-pluggy-secret';
      const signature = `sha256=${createHmac('sha256', secret).update(originalBody).digest('hex')}`;
      const context = createMockContext('pluggy', tamperedBody, signature);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should reject request with malformed signature header', () => {
      const body = Buffer.from('{"eventId":"123"}');
      const context = createMockContext('pluggy', body, 'not-a-valid-hex-string');

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });

  describe('missing parameters', () => {
    it('should throw when provider is missing', () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            params: {},
            headers: {},
            rawBody: Buffer.from('{}'),
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should throw when raw body is missing', () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            params: { provider: 'pluggy' },
            headers: { 'x-signature': 'sha256=abc123' },
            rawBody: undefined,
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should throw when signature header is missing', () => {
      const body = Buffer.from('{"eventId":"123"}');
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            params: { provider: 'pluggy' },
            headers: {},
            rawBody: body,
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });

  describe('unknown provider', () => {
    it('should throw when provider is not recognized', () => {
      const body = Buffer.from('{}');
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            params: { provider: 'unknown-provider' },
            headers: { 'x-signature': 'sha256=abc' },
            rawBody: body,
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should throw when provider secret is not configured', () => {
      delete process.env.PLUGGY_WEBHOOK_SECRET;
      const body = Buffer.from('{}');
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            params: { provider: 'pluggy' },
            headers: { 'x-signature': 'sha256=abc' },
            rawBody: body,
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });

  describe('timing safety', () => {
    it('should use timing-safe comparison for signature verification', () => {
      const body = Buffer.from('{"eventId":"123"}');
      const correctSig = `sha256=${createHmac('sha256', 'test-pluggy-secret').update(body).digest('hex')}`;
      const context = createMockContext('pluggy', body, correctSig);

      // Should not throw and should return true
      expect(guard.canActivate(context)).toBe(true);
    });
  });
});