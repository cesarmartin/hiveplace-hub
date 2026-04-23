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

## 🚀 Primeiros Passos para Iniciantes

Se você é novo em desenvolvimento ou nunca usou Docker antes, temos um guia completo para você:

**📖 [TESTING_GUIDE.md](./TESTING_GUIDE.md)** - Um guia passo a passo explicando:
- Como instalar Docker e Node.js
- Como baixar e configurar o projeto
- Como testar cada funcionalidade com exemplos práticos
- Como resolver problemas comuns

**Não sabe o que é um webhook?** O TESTING_GUIDE.md explica tudo desde o zero!

## Início rápido

```bash
# 1. Iniciar tudo
docker compose up --build

# 2. Abrir Swagger
open http://localhost:3000/docs

# 3. Emitir webhooks de teste (sem autenticação)
curl -X POST http://localhost:4001/__emit/acc-123  # Pluggy
curl -X POST http://localhost:4002/__emit/acc-456  # Belvo

# 4. Consultar transações (com autenticação)
curl -H "x-api-key: dev-api-key-change-me" http://localhost:3000/transactions

# 5. Sincronizar conta (com autenticação)
curl -X POST -H "x-api-key: dev-api-key-change-me" "http://localhost:3000/sync/acc-123?provider=pluggy"

# 6. Verificar saúde e métricas (sem autenticação)
curl http://localhost:3000/health
curl http://localhost:3000/metrics
```

## Endpoints

| Método | Caminho                      | Descrição                                      |
| ------ | ---------------------------- | ---------------------------------------------- |
| POST   | `/webhooks/:provider`        | Recebe um webhook. `:provider` ∈ {pluggy, belvo}. Assinado com HMAC. (Sem autenticação) |
| GET    | `/health`                    | Verificação de vivacidade + prontidão do DB (Sem autenticação) |
| GET    | `/metrics`                   | Métricas compatíveis com Prometheus (Sem autenticação) |
| GET    | `/docs`                      | UI do Swagger (Sem autenticação) |
| GET    | `/transactions`              | Lista todas as transações (Requer API Key) |
| GET    | `/transactions/:id`          | Busca transação por ID (Requer API Key) |
| POST   | `/sync/:accountId`           | Sincroniza transações de uma conta (Requer API Key) |

## Autenticação

### Endpoints Públicos (sem autenticação)

- `/webhooks/:provider` - Webhooks externos dos provedores
- `/health` - Health check
- `/metrics` - Métricas Prometheus
- `/docs` - Swagger UI

### Endpoints Protegidos (requerem API Key)

- `/transactions` e `/transactions/:id`
- `/sync/:accountId`

**Como usar:** Inclua o header `x-api-key` em suas requisições:

```bash
curl -H "x-api-key: dev-api-key-change-me" http://localhost:3000/transactions
```

A API key é configurada via variável de ambiente `API_KEY` (padrão: `dev-api-key-change-me`).

## Notas de segurança

- **Webhooks**: Autenticidade verificada via HMAC-SHA256 (cada provedor tem seu segredo)
- **API Interna**: Endpoints `/transactions` e `/sync` requerem API Key via header `x-api-key`
- **Logs**: Cabeçalhos sensíveis são redigidos automaticamente
- **Idempotência**: Webhooks duplicados são bloqueados via banco de dados

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

- [`MANIFEST.md`](./MANIFEST.md) - Explicação simples do que o projeto faz (para não-técnicos)
- [`TESTING_GUIDE.md`](./TESTING_GUIDE.md) - Guia completo para iniciantes absolutos
- [`DECISIONS.md`](./DECISIONS.md) - O que foi priorizado, o que foi cortado, próximos passos
