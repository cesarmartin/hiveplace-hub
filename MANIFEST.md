# O que é o HIVEPlace Integration Hub? 📦

## Explicado de Forma Simples

---

## 1. O Problema que Resolvemos 💭

**Imagine a seguinte situação:**

Sua empresa recebe pagamentos de **diferentes bancos** todos os dias.

Cada banco envia os dados de uma manera diferente:

| Banco | Formato do valor | Formato da data | Nome do campo |
|-------|------------------|-----------------|---------------|
| Banco A | "100.50" (reais) | 2023-04-22 | accountId |
| Banco B | 10050 (centavos) | 1682163000 | account_id |
| Banco C | "R$ 100,50" | 22/04/2023 | id_conta |

**Resultado:** Você recebe um caos de informações diferentes e não consegue entender o que está acontecendo!

> "Preciso ver todos os meus pagamentos em um só lugar!"
> "Por que cada banco manda de um jeito?"
> "Como vou saber o total recebido se cada um usa um formato?"

---

## 2. Nossa Solução ✨

Criamos um sistema que:

1. **Recebe** dados de qualquer banco 📨
2. **Entende** todos os formatos diferentes 🤔
3. **Transforma** tudo em um formato padrão, fácil de ler 📝
4. **Guarda** tudo no mesmo lugar 📦
5. **Mostra** quando você quiser ver 📊

**Resultado:** Você vê TODOS os pagamentos de TODOS os bancos de uma vez só!

---

## 3. Como Funciona (Analogia do Tradutor) 🌐

Pense no nosso sistema como um **tradutor universal**:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Alemão      │     │  Tradutor    │     │  Espanhol    │
│   (fala)      │     │  (converte)   │     │  (entende)   │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       ▼                    ▼                    ▼
   "Guten Tag"         "Hello there"         "Hola amigo"
```

É a mesma coisa com bancos:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Pluggy     │     │   Sistema    │     │   Você       │
│   (camelCase,│────▶│   (normaliza)│────▶│   (formato   │
│   reais)     │     │              │     │   padrão)    │
└──────────────┘     └──────────────┘     └──────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Belvo      │     │   Sistema    │     │   Você       │
│   (snake_case│────▶│   (normaliza)│────▶│   (formato   │
│   centavos)  │     │              │     │   padrão)    │
└──────────────┘     └──────────────┘     └──────────────┘
```

**Cada banco fala seu próprio "idioma", mas o sistema traduz tudo para uma linguagem comum!**

---

## 4. O que Você Pode Fazer ✅

Com o HIVEPlace, você pode:

### 📋 Ver pagamentos em tempo real
"Ainda hoje às 3 da tarde, recebi R$ 500 do João"

### 📜 Consultar histórico
"Quero ver todos os pagamentos do mês passado"

### 🔄 Sincronizar dados
"Atualize as informações da conta do Banco X"

### 🏥 Verificar se está funcionando
"Está tudo OK com o sistema?" → "Sim! Tudo verde!"

### 📊 Ver estatísticas
"Quantos pagamentos recebi hoje?"
"Quantos eram duplicados (tentativas de fraude)?"
"Quanto recebi no total?"

---

## 5. Bancos que Suportamos 🏦

### Pluggy
- Um banco digital moderno
- Envia dados em formato "americano" (camelCase)
- Usa valores em reais diretos (ex: "100.50")

### Belvo
- Plataforma de Open Finance
- Envia dados em formato "técnico" (snake_case)
- Usa valores em centavos (ex: 10050 = R$ 100,50)

### E no futuro...
Adicionar novos bancos é **fácil**! O sistema foi projetado para aceitar novos formatos rapidamente.

---

## 6. Por que é Seguro? 🔒

### Senha especial (HMAC)
Cada banco tem uma **senha única** (chamada HMAC). Quando o banco envia dados, o sistema verifica:

> "Esse dado realmente veio do Banco X? A senha está correta?"

Se não estiver, o sistema **recusa** o dado.

### Não deixa duplicar
O sistema reconhece se um pagamento já foi processado:

> "Já recebi esse pagamento antes? Se sim, ignora!"

Isso evita que:
- O mesmo pagamento seja contado duas vezes
- Tentativas de fraude funcionem

### Dados protegidos
Os dados são guardados em um banco de dados **seguro**, com backup.

---

## 7. Como Usar (Passos Simples) 📖

### Para quem recebe webhooks (bancos):

```
1. Banco envia dados para nossa API
2. Nossa API verifica se é seguro (HMAC)
3. Nossa API processa e guarda tudo
4. Pronto! Está salvo.
```

### Para quem consulta dados:

```
1. Acesse nossa documentação (Swagger)
2. Use sua chave de acesso (API Key)
3. Consulte os dados quando quiser
4. Veja todos os bancos em um só lugar!
```

---

## 8. O que NÃO Faz (Importante Saber) ⚠️

O HIVEPlace **NÃO** faz estas coisas:

| O que NÃO faz | Por quê |
|---------------|---------|
| Não faz pagamentos | Só Recebe informações, não envia dinheiro |
| Não é um banco | Apenas organiza informações vindas dos bancos |
| Não tem interface bonita | É uma API técnica (mas tem documentação clara!) |
| Não conecta diretamente ao banco | Usa webhooks (o banco nos avisa) |

**Pense assim:** Somos como a **secretária** que recebe e organiza os extratos, mas não é o banco em si.

---

## 9. Resumo Visual 🎨

```
                    ┌─────────────────────────────────┐
                    │   HIVEPlace Integration Hub     │
                    │                                 │
  ┌─────────────┐   │  ┌─────────────────────────┐  │   ┌─────────────┐
  │   Pluggy    │───▶│  │ • Recebe webhooks       │  │   │             │
  │   (Banco A) │   │  │ • Verifica segurança     │  │──▶│   Você      │
  └─────────────┘   │  │ • Transforma formatos    │  │   │  (consulta) │
                    │  │ • Guarda no banco        │  │   └─────────────┘
  ┌─────────────┐   │  │ • Mostra dados padrão    │  │
  │   Belvo     │───▶│  └─────────────────────────┘  │
  │   (Banco B) │   │                                 │
  └─────────────┘   │         Tudo junto! 🎯          │
                    └─────────────────────────────────┘
```

---

## 10. Para Desenvolvedores 💻

Se você é técnico e quer saber mais:

| Recurso | Onde encontrar |
|---------|----------------|
| Como instalar | README.md |
| Como testar | TESTING_GUIDE.md |
| Decisões técnicas | DECISIONS.md |
| Documentação da API | http://localhost:3000/docs |

---

## Conclusão 🎉

**O HIVEPlace Integration Hub é como um tradutor e organizador de pagamentos.**

- Recebe dados de qualquer banco
- Entende todos os formatos
- Mostra tudo em um lugar só
- É seguro e confiável

**Fim da confusão. Bem-vindo à simplicidade!** ✨

---

*Última atualização: Abril 2026*
