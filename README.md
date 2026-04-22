# Hub de Integração HIVEPlace

> Um hub de integração que recebe webhooks heterogêneos de múltiplos provedores no estilo Open Finance, os normaliza em um modelo de transação canônico e expõe uma API interna unificada.

Este é um **MVP focado** construído sob um prazo curto. Ele prioriza profundidade em vez de amplitude: ingestão resiliente, idempotência, observabilidade e clara separação entre contratos específicos de provedores e o modelo canônico. Veja `DECISIONS.md` para as escolhas e concessões.

---

## Arquitetura

```
   ┌──────────────┐                    ┌──────────────┐
   │ Mock Pluggy  │ POST /webhooks/pluggy    │  Mock Belvo  │ POST /webhooks/belvo
   │  (camelCase, │──────────┐         │  (snake_case,│──────────┐
   │  str amount, │          │         │  int cents,  │          │
   │  ISO dates)  │          ▼         │  epoch time) │          ▼
   └──────────────┘      ┌───────────────────────────────────────────┐
                         │            Hub de Integração              │
                         │  ┌─────────────────────────────────────┐  │
                         │  │ Ingestão de Webhooks                │  │
                         │  │  • Verificação HMAC-SHA256          │  │
                         │  │  • Idempotência (chave única no DB) │  │
                         │  │  • Resposta rápida 202 Accepted     │  │
                         │  └──────────────┬──────────────────────┘  │
                         │                 ▼                         │
                         │  ┌─────────────────────────────────────┐  │
                         │  │ Adaptadores de provedor → Modelo Canônico │  │
                         │  │  (próximo bloco: retry / CB / normalize)│  │
                         │  └──────────────┬──────────────────────┘  │
                         │                 ▼                         │
                         │  ┌─────────────────────────────────────┐  │
                         │  │ SQLite (Transação canônica)         │  │
                         │  └─────────────────────────────────────┘  │
                         │                                           │
                         │  Observabilidade: logs pino, /metrics,    │
                         │  /health, /docs (Swagger)                 │
                         └───────────────────────────────────────────┘
```

## Início rápido

```bash
# 1. Iniciar tudo
docker compose up --build

# 2. Abrir Swagger
open http://localhost:3000/docs

# 3. Emitir um webhook de teste do mock Pluggy para o hub
curl -X POST http://localhost:4001/__emit/acc-123

# 4. Emitir um webhook de teste do mock Belvo
curl -X POST http://localhost:4002/__emit/acc-456

# 5. Coletar métricas
curl http://localhost:3000/metrics

# 6. Saúde
curl http://localhost:3000/health
```

## Endpoints

| Método | Caminho                      | Descrição                                      |
| ------ | ---------------------------- | ---------------------------------------------- |
| POST   | `/webhooks/:provider`        | Recebe um webhook. `:provider` ∈ {pluggy, belvo}. Assinado com HMAC. |
| GET    | `/health`                    | Verificação de vivacidade + prontidão do DB    |
| GET    | `/metrics`                   | Métricas compatíveis com Prometheus            |
| GET    | `/docs`                      | UI do Swagger                                  |

Planejado (próximo bloco): `GET /transactions`, `GET /transactions/:id`, `POST /sync/:accountId`.

## Notas de segurança

- A autenticidade do webhook é verificada via HMAC-SHA256 sobre o **corpo bruto**. Cada provedor tem seu próprio segredo (variáveis de ambiente `PLUGGY_WEBHOOK_SECRET` / `BELVO_WEBHOOK_SECRET`).
- Cabeçalhos sensíveis são redigidos dos logs no nível de transporte do pino.
- Entregas duplicadas de webhook são deduplicadas de forma idempotente através de um registro persistido em banco de dados.

## Pilha de tecnologia

- **Runtime**: Node.js 20 + TypeScript
- **Framework**: NestJS
- **Persistência**: SQLite via Prisma (intercambiável com Postgres — veja `DECISIONS.md`)
- **Observabilidade**: logs estruturados pino, prom-client, Swagger/OpenAPI
- **Empacotamento**: Docker + docker-compose

## Layout do projeto

```
src/
├── main.ts                  # bootstrap, raw-body, swagger, pino
├── app.module.ts
├── webhooks/                # ingresso de webhook + HMAC + idempotência
├── common/
│   ├── health.controller.ts
│   ├── metrics/
│   └── prisma.service.ts
prisma/
├── schema.prisma            # Transação canônica + IdempotencyKey
└── migrations/
mocks/
├── pluggy-mock.ts           # contrato deliberadamente divergente A
└── belvo-mock.ts            # contrato deliberadamente divergente B
tests/
├── unit/
└── integration/
```

## Executando testes

```bash
npm install
npm run prisma:generate
npm run test
```

## Veja também

- [`DECISIONS.md`](./DECISIONS.md) — o que foi priorizado, o que foi cortado, o que eu faria com mais tempo.
