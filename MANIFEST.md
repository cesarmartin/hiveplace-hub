# MANIFEST.md — HIVEPlace Integration Hub

## Visão Geral

**HIVEPlace Integration Hub** é um hub de integração MVP que ingere webhooks heterogêneos de múltiplos provedores Open Finance, normaliza-os em um modelo de transação canônico e expõe uma API interna unificada.

**Provedores suportados:** Pluggy, Belvo  
**Modelo canônico:** Transação normalizada (formato agnostic de provedor)

---

## Arquitetura

```
┌──────────────┐                     ┌──────────────┐
│ Mock Pluggy  │ POST /webhooks/pluggy    │  Mock Belvo  │ POST /webhooks/belvo
│  (camelCase, │──────────┐         │  (snake_case,│──────────┐
│  str amount, │          │         │  int cents,  │          │
│  ISO dates)  │          ▼         │  epoch time) │          ▼
└──────────────┘      ┌───────────────────────────────────────────┐
                      │            Hub de Integração              │
                      │  • Verificação HMAC-SHA256                 │
                      │  • Idempotência via DB                    │
                      │  • Resposta 202 Accepted                  │
                      │  • Normalização → Modelo Canônico          │
                      │  • Persistência SQLite                    │
                      └───────────────────────────────────────────┘
```

---

## Pilha de Tecnologia

| Componente       | Tecnologia                          |
| ---------------- | ----------------------------------- |
| Runtime          | Node.js 20 + TypeScript             |
| Framework        | NestJS                              |
| Persistência     | SQLite via Prisma                   |
| Observabilidade  | pino (logs), prom-client (métricas) |
| Containerização  | Docker + docker-compose              |

---

## Endpoints

| Método | Caminho                 | Descrição                                      |
| ------ | ----------------------- | ---------------------------------------------- |
| POST   | `/webhooks/:provider`   | Ingestão de webhook (pluggy ou belvo)          |
| GET    | `/health`               | Health check com validação de DB               |
| GET    | `/metrics`              | Métricas Prometheus                            |
| GET    | `/docs`                 | Swagger UI                                     |

---

## Segurança

- **HMAC-SHA256**: corpo bruto verificado contra segredo do provedor
- **Idempotência**: chave única no banco de dados previne duplicatas
- **Redação de logs**: cabeçalhos sensíveis são redigidos automaticamente

---

## Design de Contrato

Cada provedor possui um contrato de entrada deliberadamente diferente:

| Campo          | Pluggy         | Belvo           |
| -------------- | -------------- | --------------- |
| Identificador  | `transactionId`| `externalId`    |
| Valor          | `amount` (str) | `amount` (cents)|
| Datas          | ISO 8601       | Epoch timestamp |
| Case           | camelCase      | snake_case      |

O adaptador normaliza ambos para o **modelo canônico**.

---

## Decisões Prioritárias

### O que foi priorizado
1. **Resiliência na ingestão** — HMAC + idempotência + resposta rápida
2. **Separação clara** — contrato externo vs. modelo canônico isolados
3. **Observabilidade** — logs estruturados, métricas, health check
4. **Idempotência real** — UNIQUE key no SQLite como fonte da verdade

### O que ficou fora do escopo
- Auth/authorization global da API
- Fila persistente (RabbitMQ/BullMQ) — atual: in-memory
- Distributed tracing (OpenTelemetry)
- UI de admin — Swagger é suficiente

---

## Riscos Conhecidos

| Risco                              | Mitigação atual            |
| ---------------------------------- | -------------------------- |
| Divergência de estados             | Last-write-wins implícito  |
| Clock skew em HMAC                 | Sem validação de timestamp |
| Schema drift silencioso            | `rawPayload` persistido    |
| SQLite em produção                 | Volume persistente (Docker)|

---

## Como expandir

### Adicionar novo provedor
1. Criar adapter em `src/webhooks/adapters/`
2. Implementar interface `ProviderAdapter`
3. Adicionar secret no `.env`
4. Registrar rota no webhook controller

### Escalabilidade horizontal
- Mover idempotência para Redis
- Substituir fila in-memory por RabbitMQ
- Adicionar `tenantId` para multi-tenant

---

## Referências

- [`README.md`](./README.md) — Início rápido e configuração
- [`DECISIONS.md`](./DECISIONS.md) — Trade-offs técnicos detalhados
- [`TESTING_GUIDE.md`](./TESTING_GUIDE.md) — Guia de testes
