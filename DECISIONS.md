# Decisões Técnicas

Documento de trade-offs assumidos deliberadamente, dado o prazo curto da entrega.

## O que foi priorizado e por quê

1. **Resiliência na ingestão de webhooks**, não apenas throughput. HMAC + idempotência + resposta 202 rápida são o contrato mínimo que um provedor sério espera. Sem isso, qualquer integração em produção vira pesadelo.
2. **Separação limpa entre contrato externo e modelo canônico**. O coração do problema é que cada provedor fala uma língua diferente. Isolar isso em adapters deixa o resto do sistema imune.
3. **Observabilidade de primeira classe**. Logs estruturados (pino), métricas Prometheus, health com check de DB. É o mínimo operacional que um hub de integração precisa ter no dia 1.
4. **Idempotência real**, não cosmética. Usando UNIQUE key no SQLite como fonte da verdade. Safe across restarts.

## O que ficou fora do escopo

- **Auth/authorization da API interna**: há um `API_KEY` documentado, mas não está aplicado como guard global. Em produção, seria um guard sobre os endpoints de consulta + rotação de keys.
- **Fila persistente (RabbitMQ/BullMQ)**: no bloc de normalização, usarei uma fila **in-memory** no mesmo processo. Trade-off consciente: entrega em prazo vs. robustez. Em produção, RabbitMQ com dead-letter + retry exponencial é o caminho (experiência relevante: gerencio cluster RabbitMQ de 4 nós com Khepri em produção).
- **Distributed tracing (OpenTelemetry)**: métricas e logs já cobrem ~80% dos casos de debug. Tracing adiciona valor em N+1 serviços; aqui temos 1.
- **UI de admin**: Swagger é a UI. Um frontend consumiria tempo desproporcional ao ganho.
- **Múltiplos tipos de auth**: um API key simples resolve o escopo do desafio; OAuth2/mTLS seriam excesso.

## O que faria com mais tempo

1. **Mover idempotência e filas para Redis**. A versão atual em SQLite resolve single-instance; multi-instance exige Redis (`SET NX EX`) ou similar.
2. **Dead-letter queue para eventos que falham após N retries**. Essencial para não perder dados silenciosamente.
3. **Replay/reprocessamento de eventos por janela de tempo**. Endpoint admin tipo `POST /admin/replay?from=...&to=...&provider=...`.
4. **Adapters configuráveis via manifest** (schema-driven) em vez de código. Reduz o custo de adicionar um 3º, 4º provedor.
5. **Contract tests por provedor** (Pact-style): um suite que valida que mudanças no schema externo não quebram o adapter silenciosamente.
6. **Schema versioning no payload bruto persistido**: quando o provedor mudar o contrato, conseguimos reprocessar payloads antigos com adapters novos.

## Principais riscos técnicos

- **Divergência de estados entre provedor e canônico**: se um provedor reenviar com status diferente para o mesmo `external_id`, qual ganha? Decisão atual (implícita): last-write-wins por `receivedAt`. Merecia política explícita documentada.
- **Clock skew em HMAC**: a implementação atual não valida timestamp do webhook. Um atacante com payload + sig antigos poderia reenviar. Mitigação trivial: exigir header `x-timestamp` dentro de janela ±5min.
- **Schema drift silencioso**: se o provedor adicionar um campo novo com significado importante, o adapter ignora. Mitigação: persistir `rawPayload` completo para auditoria/reprocessamento (já feito no schema).
- **SQLite em container**: volume persistente está configurado, mas backup e rotação ficam por conta da orquestração. Em produção seria Postgres gerenciado.

## Como escalaria

- **Horizontal**: instâncias sem estado, idempotência movida para Redis, fila movida para RabbitMQ/SQS. O hub em si já é stateless exceto pela conexão Prisma.
- **Por provedor**: adicionar novo provedor = novo adapter implementando a mesma interface + novo secret no env + nova rota no controller (ou single route com discriminator). Nenhuma mudança no modelo canônico se o mapeamento for viável.
- **Alto volume**: particionar por `accountId` na fila (preserva ordem por conta), sharding de DB por hash de accountId quando a tabela crescer.
- **Multi-tenant**: adicionar `tenantId` na canonical model, prefixar chaves de idempotência com tenant, row-level filter em todas as consultas.

## Escolhas de stack justificadas

| Escolha                  | Razão                                                                 |
| ------------------------ | --------------------------------------------------------------------- |
| NestJS                   | Alinhamento cultural com o stack da empresa (mencionado no Perfil Plataformas). Estrutura modular pronta, Swagger automático. |
| TypeScript               | Contratos tipados entre camadas reduzem bugs de normalização.         |
| Prisma                   | Migrations versionadas, type-safe. Custo: acoplamento ao ORM.         |
| SQLite                   | Zero-setup para prazo curto. `DATABASE_URL` permite trocar por Postgres sem mudar código. |
| pino                     | Logger estruturado mais rápido do ecossistema Node. Custo: menos plugins que winston. |
| prom-client              | Padrão de facto para métricas Prometheus em Node.                     |
| Fila in-memory (próxima) | Pragmatismo para entrega. Trocável por RabbitMQ/BullMQ sem mudar contratos. |
