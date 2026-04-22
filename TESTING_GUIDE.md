# Guia Completo de Testes para HIVEPlace - Iniciantes Absolutos 🚀

Bem-vindo ao HIVEPlace! Este guia vai te ajudar a testar o sistema de integração de webhooks, mesmo que você nunca tenha usado Docker ou linha de comando antes. Cada passo é explicado em detalhes simples.

---

## 🖥️ Preparando seu Computador

Antes de começar, você precisa instalar duas ferramentas essenciais no seu computador.

### Passo 1: Instalar o Docker

O Docker é um programa que permite rodar aplicações em "containers" isolados, sem precisar instalar todas as dependências manualmente.

**Como instalar:**

1. Acesse: https://www.docker.com/products/docker-desktop
2. Clique no botão de download adequado para o seu sistema operacional (Windows, Mac ou Linux)
3. Execute o arquivo baixado e siga o assistente de instalação
4. **Importante:** Durante a instalação no Windows, marque a opção "Use WSL 2 instead of Hyper-V" se aparecer
5. Após instalar, abra o Docker Desktop (procure pelo ícone da baleia Docker na sua área de trabalho ou lista de programas)

**Verificando se instalou corretamente:**
- Abra o terminal (Prompt de Comando no Windows, Terminal no Mac/Linux)
- Digite: `docker --version`
- Você deve ver algo como: `Docker version 24.0.0`

### Passo 2: Instalar o Node.js

O Node.js é o ambiente que executa o código JavaScript do projeto.

**Como instalar:**

1. Acesse: https://nodejs.org/
2. Baixe a versão **20.x LTS** (LTS significa "Suporte de Longo Prazo", mais estável)
3. Execute o instalador e siga os passos
4. **Importante:** Na tela "Tools for Native Modules", marque a opção para instalar npm

**Verificando se instalou corretamente:**
- Abra um novo terminal
- Digite: `node --version`
- Você deve ver algo como: `v20.10.0`
- Digite: `npm --version`
- Você deve ver algo como: `10.2.0`

---

## 📥 Baixando o Projeto

Agora vamos baixar o código do projeto para o seu computador.

### Passo 3: Baixar com Git

```bash
# Abra o terminal e execute estes comandos:

# 1. Navegue até a pasta onde quer guardar o projeto
# (substitua ~/projetos pelo caminho desejado)
cd ~/projetos

# 2. Baixe o código do repositório
git clone https://github.com/hiveplace/integration-hub.git

# 3. Entre na pasta do projeto
cd integration-hub
```

### Passo 4: Instalar Dependências

As dependências são bibliotecas externas que o projeto precisa para funcionar.

```bash
# Ainda dentro da pasta do projeto, execute:
npm install
```

Isso pode demorar alguns minutos. Você verá muitas mensagens passando na tela. Aguarde até voltar a aparecer o prompt (símbolo `$`).

### Passo 5: Gerar Tipos do Prisma

O Prisma é uma ferramenta que ajuda a trabalhar com o banco de dados. Este comando prepara tudo para que o banco funcione corretamente.

```bash
# Execute este comando:
npm run prisma:generate
```

Você deve ver uma mensagem de sucesso como: `Generated Prisma Client`.

---

## 🧪 Testando a Aplicação

Agora vamos fazer a aplicação rodar e testar os webhooks!

### Iniciar Ambiente de Testes

```bash
# Este comando constrói e inicia todos os serviços
docker compose up --build
```

**O que acontece:**
- O Docker vai baixar imagens necessárias (pode demorar na primeira vez)
- Vai criar 3 serviços: o app principal e dois "mocks" (simuladores)
- Quando ver mensagens sem novos números aparecendo, significa que está rodando

**Importante:** Mantenha esta janela do terminal aberta enquanto testa. Os serviços estão rodando!

### 🔐 Autenticação por API Key

Os endpoints internos da API são protegidos por autenticação via API Key. Isso garante que apenas consumidores autorizados possam acessar as operações de transação e sincronização.

#### O que é uma API Key?

Uma API Key é uma string única que identifica o cliente fazendo a requisição. É como uma "senha" que você inclui no header da requisição para provar que tem permissão para usar o endpoint.

#### Quais Endpoints Precisam de Autenticação?

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/transactions` | GET | Listar todas as transações |
| `/transactions/:id` | GET | Buscar uma transação específica |
| `/sync/:accountId` | POST | Sincronizar transações de uma conta |

#### Quais Endpoints NÃO Precisam de Autenticação?

- `/webhooks/:provider` - Recebimento de webhooks (aberto para provedores)
- `/health` - Verificação de saúde do sistema
- `/metrics` - Métricas Prometheus
- `/docs` - Documentação Swagger

#### Como Usar a API Key

A API key padrão para desenvolvimento está no arquivo `.env.example`:
```
API_KEY=dev-api-key-change-me
```

Para fazer requisições autenticadas, inclua o header `x-api-key`:

```bash
curl -H "x-api-key: dev-api-key-change-me" http://localhost:3300/transactions
```

#### Exemplos de Requisições Autenticadas

**Listar transações (com autenticação):**
```bash
curl -H "x-api-key: dev-api-key-change-me" http://localhost:3300/transactions
```

**Listar transações (SEM autenticação - vai falhar!):**
```bash
curl http://localhost:3300/transactions
# Resposta: {"statusCode":401,"message":"Unauthorized"}
```

**Sincronizar conta do Pluggy:**
```bash
curl -X POST -H "x-api-key: dev-api-key-change-me" \
  "http://localhost:3300/sync/acc-123?provider=pluggy"
```

**Buscar uma transação específica:**
```bash
curl -H "x-api-key: dev-api-key-change-me" \
  "http://localhost:3300/transactions/tx-pluggy-001"
```

#### Usando o Swagger UI com API Key

1. Acesse: http://localhost:3300/docs
2. Clique no botão **"Authorize"** (cadeado) no topo da página
3. No campo "value", digite: `dev-api-key-change-me`
4. Clique em **"Authorize"** e depois em **"Close"**
5. Agora todas as requisições feitas pelo Swagger incluirão automaticamente a API key

---

### 📋 Cenários de Teste

Abra **uma nova janela/aba do terminal** para executar os comandos de teste.

---

#### Teste 1: Webhook do Pluggy

O Pluggy é um dos provedores de dados financeiros que enviamos webhooks.

```bash
curl -X POST http://localhost:4001/__emit/acc-123 \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "acc-123",
    "transactionId": "tx-pluggy-001",
    "amount": "100.50",
    "date": "2023-04-22T10:30:00Z",
    "description": "Teste de webhook Pluggy"
  }'
```

**O que esperar:**
- Resposta: `Webhook emitted successfully`
- No terminal do Docker, você verá logs do processamento

#### Teste 2: Webhook do Belvo

O Belvo é outro provedor de dados financeiros.

```bash
curl -X POST http://localhost:4002/__emit/acc-456 \
  -H "Content-Type: application/json" \
  -d '{
    "account_id": "acc-456",
    "transaction_id": "tx-belvo-001",
    "amount_in_cents": 10050,
    "date": 1682163000,
    "description": "Teste de webhook Belvo"
  }'
```

**Nota sobre formatos:**
- Perceba que o Belvo usa `snake_case` (`account_id`, `amount_in_cents`)
- E o Pluggy usa `camelCase` (`accountId`, `amount`)
- O HIVEPlace normaliza tudo para um formato único!

#### Teste 3: Enviando Múltiplas Transações

Teste o sistema de idempotência (ele não deve processar duplicatas):

```bash
# Envie a mesma transação duas vezes
curl -X POST http://localhost:4001/__emit/acc-123 \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "acc-123",
    "transactionId": "tx-pluggy-duplicate",
    "amount": "50.00",
    "date": "2023-04-22T11:00:00Z",
    "description": "Transação duplicada"
  }'

# Aguarde 1 segundo e envie novamente
curl -X POST http://localhost:4001/__emit/acc-123 \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "acc-123",
    "transactionId": "tx-pluggy-duplicate",
    "amount": "50.00",
    "date": "2023-04-22T11:00:00Z",
    "description": "Transação duplicada"
  }'
```

**O que esperar:** A segunda transação deve ser rejeitada (sistema de deduplicação funcionou!)

---

## 🎯 Testes E2E (Ponta a Ponta) - O Sistema Inteiro Funcionando

### O que são testes E2E? (Explicado para sua avó!)

**Testes E2E** verificam se TUDO funciona junto, do início ao fim.

Imagine que você quer testar se um **carro funciona**:
- ❌ Não é só testar o motor sozinho
- ❌ Não é só testar as rodas sozinhas
- ✅ É ligar, acelerar, frear e dirigir - **tudo junto**

É a mesma coisa com nosso sistema:
- ❌ Não é só verificar se o banco de dados funciona
- ❌ Não é só verificar se a API funciona
- ✅ É enviar dados de um banco, ver se o sistema entende, guarda e mostra - **tudo junto!**

---

### 1. O que vamos testar (explicação simples)

Vamos verificar se o sistema consegue:
1. ✅ **Receber** dados de bancos diferentes (Pluggy e Belvo)
2. ✅ **Entender** cada formato diferente que cada banco usa
3. ✅ **Transformar** esses dados em um formato padrão
4. ✅ **Guardar** tudo no banco de dados
5. ✅ **Mostrar** os dados depois, de um jeito fácil de ler

---

### 2. Teste 1: Enviar dinheiro do "banco Pluggy" 💳

```bash
# Simular que o banco Pluggy enviou um pagamento de R$ 100,50
curl -X POST http://localhost:4001/__emit/acc-123 \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "acc-123",
    "transactionId": "tx-pluggy-001",
    "amount": "100.50",
    "date": "2023-04-22T10:30:00Z",
    "description": "Pagamento de cliente"
  }'
```

**O que acontece por trás (explicação simples):**
1. O sistema **recebe** o aviso do banco
2. **Verifica** se é realmente o banco (usando uma senha especial chamada HMAC)
3. **Transforma** o formato do banco Pluggy no formato padrão do sistema
4. **Guarda** no "caderninho" (banco de dados)
5. **Responde** rápido: "Ok, recebi!"

---

### 3. Teste 2: Enviar dinheiro do "banco Belvo" 💰

```bash
# Simular que o banco Belvo enviou um pagamento de R$ 50,25
curl -X POST http://localhost:4002/__emit/acc-456 \
  -H "Content-Type: application/json" \
  -d '{
    "account_id": "acc-456",
    "transaction_id": "tx-belvo-001",
    "amount_in_cents": 5025,
    "date": 1682163000,
    "description": "Compra no mercado"
  }'
```

**Diferença importante (explicação simples):**
- O Belvo fala `"account_id"` enquanto Pluggy fala `"accountId"`
- O Belvo manda valores em **centavos** (5025 = R$ 50,25)
- O Pluggy manda valores **diretos** ("100.50")
- **O sistema entende os dois e guarda tudo do mesmo jeito!** 🎉

---

### 4. Teste 3: Ver se os dados foram guardados 📋

```bash
# Pedir para ver todas as transações guardadas
curl -H "x-api-key: dev-api-key-change-me" http://localhost:3000/transactions
```

**O que você deve ver:**
- Uma lista com as duas transações (Pluggy e Belvo)
- Ambas no **MESMO formato**, fácil de ler
- Valores corretos: R$ 100,50 e R$ 50,25

**Se não funcionar:** Verifique se adicionou o header `x-api-key` corretamente!

---

### 5. Teste 4: O sistema não deixa duplicar! 🚫

```bash
# Primeira vez: enviar uma transação
curl -X POST http://localhost:4001/__emit/acc-123 \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "acc-123",
    "transactionId": "tx-duplicada",
    "amount": "10.00",
    "date": "2023-04-22T11:00:00Z",
    "description": "Teste duplicado"
  }'

# Esperar 2 segundos e enviar NOVAMENTE a mesma coisa
curl -X POST http://localhost:4001/__emit/acc-123 \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "acc-123",
    "transactionId": "tx-duplicada",
    "amount": "10.00",
    "date": "2023-04-22T11:00:00Z",
    "description": "Teste duplicado"
  }'
```

**O que acontece:**
- **Primeira vez:** sistema guarda a transação ✅
- **Segunda vez:** sistema reconhece que já viu essa transação e **IGNORA** 🚫
- **Isso evita que o mesmo pagamento seja contado duas vezes!** (Imagina pagar a mesma conta duas vezes! 😱)

---

### 6. Teste 5: Ver as métricas (painel de controle) 📊

```bash
# Ver quantas transações foram recebidas, processadas, etc
curl http://localhost:3000/metrics
```

**O que procurar (procure estas linhas):**

| Métrica | Significado |
|---------|-------------|
| `webhooks_received_total` | Quantos avisos recebemos no total |
| `webhooks_processed_total` | Quantos processamos com sucesso |
| `webhooks_duplicates_total` | Quantos duplicados bloqueamos |

**Exemplo de saída:**
```
# HELP webhooks_received_total Total number of webhooks received
# TYPE webhooks_received_total counter
webhooks_received_total 5
webhooks_processed_total 4
webhooks_duplicates_total 1
```

Isso significa:
- Recebemos 5 webhooks
- 4 foram processados com sucesso
- 1 foi bloqueado porque era duplicado

---

### 7. Resumo: Fluxo Completo de um Teste E2E ✅

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Você      │      │   Sistema   │      │  Banco de   │
│  (usuário)  │      │  (HIVEPlace)│      │   Dados     │
└─────────────┘      └─────────────┘      └─────────────┘
      │                    │                    │
      │  1. Enviar dados    │                    │
      │───────────────────▶│                    │
      │                    │  2. Verificar HMAC  │
      │                    │  3. Transformar     │
      │                    │  4. Guardar         │
      │                    │───────────────────▶│
      │                    │                    │
      │  5. "Ok, recebi!"   │                    │
      │◀───────────────────│                    │
      │                    │                    │
      │  6. Ver dados       │                    │
      │───────────────────▶│                    │
      │                    │  7. Buscar dados   │
      │                    │───────────────────▶│
      │                    │                    │
      │  8. Lista de todos  │                    │
      │◀───────────────────│                    │
      │                    │                    │
```

---

### 8. Parabéns! Você sabe fazer testes E2E! 🎉

Se você conseguiu fazer os 5 testes acima, parabéns! Você acabou de verificar que:

1. ✅ O sistema **recebe** dados de diferentes bancos
2. ✅ O sistema **entende** formatos diferentes
3. ✅ O sistema **guarda** os dados corretamente
4. ✅ O sistema **não duplica** transações
5. ✅ Você consegue **ver** os dados depois

**Isso é o equivalente a testar que um carro anda, freia, e não explode!** 🚗💨

---

## 🕵️ Verificando Resultados

Vamos consultar os dados processados:

### Consultar Métricas do Sistema

As métricas mostram como o sistema está performando:

```bash
curl http://localhost:3300/metrics
```

**O que esperar:** Uma lista de métricas em formato texto, incluindo:
- `webhooks_received_total` - total de webhooks recebidos
- `webhooks_processed_total` - webhooks processados com sucesso
- `webhooks_duplicates_total` - webhooks duplicados bloqueados

### Verificar Saúde do Sistema

```bash
curl http://localhost:3300/health
```

**O que esperar:** Resposta JSON com status `"status": "ok"`

### Verificar Documentação da API (Swagger)

1. Abra seu navegador
2. Acesse: http://localhost:3300/docs
3. Explore a interface interativa para ver todos os endpoints disponíveis
4. **Dica:** Clique no botão "Authorize" (cadeado) para configurar sua API key e testar os endpoints protegidos diretamente pelo Swagger

### Consultar Transações (Endpoints Protegidos)

Os endpoints `/transactions` e `/sync/:accountId` requerem autenticação:

**Listar todas as transações:**
```bash
curl -H "x-api-key: dev-api-key-change-me" http://localhost:3300/transactions
```

**Sincronizar transações de uma conta:**
```bash
curl -X POST -H "x-api-key: dev-api-key-change-me" \
  "http://localhost:3300/sync/acc-123?provider=pluggy"
```

---

## 🚨 Solução de Problemas

### Erros Comuns e Como Resolver

#### ❌ "Docker: command not found"

**Problema:** O Docker não está instalado ou não foi reconhecido.

**Solução:**
1. Verifique se o Docker Desktop está aberto (procure o ícone da baleia)
2. Se acabou de instalar, reinicie o computador
3. No Windows, procure por "Docker Desktop" no Menu Iniciar e abra

#### ❌ "Porta já está em uso"

**Problema:** Outra aplicação está usando a porta 3300, 4001 ou 4002.

**Solução no Windows:**
```powershell
# Descobrir qual processo está usando a porta
netstat -ano | findstr :3300

# Para o processo (substitua o número do PID)
taskkill /PID <NUMERO_DO_PID> /F
```

**Solução no Mac/Linux:**
```bash
# Descobrir qual processo está usando a porta
lsof -i :3300

# Para o processo (substitua o PID)
kill -9 <PID>
```

#### ❌ "npm install" não funciona

**Problema:** Problemas com o cache ou conexão de internet.

**Solução:**
```bash
# Limpar o cache do npm
npm cache clean --force

# Tentar novamente
npm install
```

#### ❌ "docker compose up" fica "stuck" ou travado

**Problema:** Pode ser problema de configuração ou recursos.

**Solução:**
1. Pressione `Ctrl+C` para parar
2. Limpe os containers: `docker compose down`
3. Remova containers órfãos: `docker container prune`
4. Tente novamente: `docker compose up --build`

#### ❌ Erro de permissão ao acessar portas

**Problema:** Permissões insuficientes para acessar as portas.

**Solução:**
- No Linux, execute com `sudo docker compose up`
- No Mac/Windows, execute o terminal como administrador

#### ❌ "401 Unauthorized" ao acessar endpoints

**Problema:** Você está tentando acessar um endpoint protegido sem a API key.

**Endpoints que requerem autenticação:**
- `GET /transactions`
- `GET /transactions/:id`
- `POST /sync/:accountId`

**Solução:**
Inclua o header `x-api-key` na requisição:
```bash
curl -H "x-api-key: dev-api-key-change-me" http://localhost:3300/transactions
```

**Alternativa pelo Swagger:**
1. Acesse http://localhost:3300/docs
2. Clique em "Authorize" (cadeado)
3. Digite `dev-api-key-change-me` e clique em "Authorize"

#### ❌ Banco de dados corrompido

**Problema:** Erros estranhos de query ou dados inconsistentes.

**Solução:**
```bash
# Parar tudo
docker compose down

# Remover o banco de dados antigo
rm -rf ./data/*.db

# Iniciar novamente (o banco será recriado)
docker compose up --build
```

---

## 🎓 Aprendendo Mais

### Estrutura do Projeto

```
integration-hub/
├── mocks/              # Simuladores de provedores
│   ├── pluggy-mock.ts
│   └── belvo-mock.ts
├── src/
│   ├── adapters/       # Adaptadores para cada provedor
│   ├── core/           # Lógica central
│   └── main.ts         # Entry point
├── prisma/
│   └── schema.prisma   # Definição do banco de dados
└── docker-compose.yml  # Configuração dos serviços
```

### Como os Webhooks Funcionam

1. **Recebimento:** O sistema recebe um webhook de um provedor (Pluggy ou Belvo)
2. **Verificação:** O HMAC-SHA256 verifica se o webhook é autêntico
3. **Normalização:** Converte o formato específico do provedor para o formato canônico
4. **Deduplicação:** Verifica se a transação já foi processada (idempotência)
5. **Persistência:** Salva no banco de dados
6. **Resposta:** Retorna 202 Accepted rapidamente

### Endpoints Protegidos por API Key

Os seguintes endpoints requerem autenticação via API key para serem acessados:

| Endpoint | Descrição |
|----------|-----------|
| `GET /transactions` | Lista todas as transações salvas |
| `GET /transactions/:id` | Busca uma transação pelo ID |
| `POST /sync/:accountId` | Força sincronização com o provedor |

Os webhooks, health check e métricas permanecem abertos (sem autenticação).

### Diferenças entre Provedores

| Aspecto | Pluggy | Belvo |
|---------|--------|-------|
| Formato de dados | camelCase | snake_case |
| Identificador | `accountId` | `account_id` |
| Valor | Decimal string (`"100.50"`) | Inteiro em centavos (`10050`) |
| Data | ISO 8601 (`2023-04-22T10:30:00Z`) | Unix timestamp (`1682163000`) |

---

## 📝 Dicas Finais

### Mantendo o Ambiente Limpo

Sempre pare os serviços corretamente:

```bash
# No terminal onde está rodando o docker compose
# Pressione Ctrl+C para parar graciosamente

# Ou em outro terminal:
docker compose down

# Para remover também os volumes (limpeza completa):
docker compose down -v
```

### Mantendo o Docker Atualizado

O Docker Desktop verifica atualizações automaticamente. Para atualizar manualmente:
1. Clique com botão direito no ícone do Docker
2. Selecione "Check for Updates"
3. Instale a nova versão se disponível

### Comandos Úteis de Debug

```bash
# Ver logs em tempo real
docker compose logs -f app

# Ver logs de um serviço específico
docker compose logs -f pluggy-mock

# Ver todos os containers ativos
docker ps

# Reiniciar apenas um serviço
docker compose restart app
```

### Quando Pedir Ajuda

Se algo não funcionar mesmo seguindo os passos:
1. Tire um print da tela de erro
2. Anote os comandos que você executou
3. Copie as mensagens de erro completas
4. Compartilhe no canal de suporte

---

## 📞 Referência Rápida

### Endpoints e Portas

| Serviço | URL | Propósito | Autenticação |
|---------|-----|-----------|--------------|
| App Principal | http://localhost:3300 | API do hub | - |
| Swagger Docs | http://localhost:3300/docs | Documentação interativa | Opcional* |
| Métricas | http://localhost:3300/metrics | Prometheus metrics | Não requer |
| Health Check | http://localhost:3300/health | Status do sistema | Não requer |
| Pluggy Mock | http://localhost:4001 | Simulador Pluggy | Não requer |
| Belvo Mock | http://localhost:4002 | Simulador Belvo | Não requer |

*\* O Swagger permite configurar a API key para testar endpoints protegidos.

### Contas de Teste

| Provedor | Account ID | Secret |
|----------|------------|--------|
| Pluggy | `acc-123` | `dev-pluggy-secret` |
| Belvo | `acc-456` | `dev-belvo-secret` |

### Comandos Essenciais

| Ação | Comando |
|------|---------|
| Iniciar | `docker compose up --build` |
| Parar | `Ctrl+C` ou `docker compose down` |
| Ver logs | `docker compose logs -f` |
| Recriar banco | `rm -rf ./data/*.db && docker compose up --build` |

---

Boa sorte com os testes! 🎉
