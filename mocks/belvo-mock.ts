/**
 * Belvo-style mock provider.
 *
 * Payload conventions (deliberately divergent from Pluggy):
 *   - snake_case field names
 *   - amount as INTEGER in cents: 12345
 *   - timestamps as Unix epoch seconds
 *   - transaction_type as NUMERIC code: 1 = inflow (credit), 2 = outflow (debit)
 *   - status_code as NUMERIC: 0 = pending, 1 = posted, 2 = failed
 *
 * This divergence is the point — the canonical adapter must translate both.
 */
import express from 'express';
import { createHmac, randomUUID } from 'crypto';

const PORT = Number(process.env.PORT ?? 4002);
const HUB_URL = process.env.HUB_URL ?? 'http://app:3000';
const SECRET = process.env.BELVO_WEBHOOK_SECRET ?? 'dev-belvo-secret';

const app = express();
app.use(express.json());

const store: Record<string, any[]> = {};

function sampleTx(accountId: string) {
  return {
    notification_id: randomUUID(),
    account_id: accountId,
    amount_cents: Math.floor(Math.random() * 100000),
    currency_code: 'BRL',
    transaction_type: Math.random() > 0.5 ? 1 : 2,
    status_code: 1,
    occurred_at_epoch: Math.floor(Date.now() / 1000),
  };
}

app.get('/accounts/:accountId/movements', (req, res) => {
  const { accountId } = req.params;
  if (!store[accountId]) {
    store[accountId] = Array.from({ length: 3 }, () => sampleTx(accountId));
  }
  res.json({ account_id: accountId, movements: store[accountId] });
});

app.post('/__emit/:accountId', async (req, res) => {
  const { accountId } = req.params;
  const tx = sampleTx(accountId);
  const body = JSON.stringify(tx);
  const sig = createHmac('sha256', SECRET).update(body).digest('hex');

  try {
    const response = await fetch(`${HUB_URL}/webhooks/belvo`, {
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

app.get('/health', (_req, res) => res.json({ status: 'ok', provider: 'belvo' }));

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[belvo-mock] listening on :${PORT}`);
});
