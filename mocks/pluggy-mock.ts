/**
 * Pluggy-style mock provider.
 *
 * Payload conventions (deliberately divergent from Belvo):
 *   - camelCase field names
 *   - amount as STRING with decimal point: "123.45"
 *   - timestamps as ISO-8601 strings
 *   - type enum: "CREDIT" | "DEBIT"
 *   - status enum: "PENDING" | "POSTED" | "FAILED"
 *
 * Exposes:
 *   GET  /accounts/:accountId/transactions   — pull endpoint (for sync)
 *   POST /__emit/:accountId                  — helper to emit a webhook to the hub
 */
import express from 'express';
import { createHmac, randomUUID } from 'crypto';

const PORT = Number(process.env.PORT ?? 4001);
const HUB_URL = process.env.HUB_URL ?? 'http://app:3000';
const SECRET = process.env.PLUGGY_WEBHOOK_SECRET ?? 'dev-pluggy-secret';

const app = express();
app.use(express.json());

// In-memory store so pull and push stay consistent
const store: Record<string, any[]> = {};

function sampleTx(accountId: string) {
  return {
    eventId: randomUUID(),
    accountId,
    amount: (Math.random() * 1000).toFixed(2),
    currency: 'BRL',
    type: Math.random() > 0.5 ? 'CREDIT' : 'DEBIT',
    status: 'POSTED',
    occurredAt: new Date().toISOString(),
  };
}

app.get('/accounts/:accountId/transactions', (req, res) => {
  const { accountId } = req.params;
  if (!store[accountId]) {
    store[accountId] = Array.from({ length: 3 }, () => sampleTx(accountId));
  }
  res.json({ accountId, transactions: store[accountId] });
});

app.post('/__emit/:accountId', async (req, res) => {
  const { accountId } = req.params;
  const tx = sampleTx(accountId);
  const body = JSON.stringify(tx);
  const sig = createHmac('sha256', SECRET).update(body).digest('hex');

  try {
    const response = await fetch(`${HUB_URL}/webhooks/pluggy`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-signature': `sha256=${sig}`,
      },
      body,
    });
    res.json({ emitted: tx, hubStatus: response.status });
  } catch (err: any) {
    res.status(502).json({ error: 'failed to reach hub', detail: err.message });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', provider: 'pluggy' }));

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[pluggy-mock] listening on :${PORT}`);
});
