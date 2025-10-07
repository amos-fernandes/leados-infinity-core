# Sistema de Agendamento de Mensagens WhatsApp

## 📋 Visão Geral

Sistema completo de agendamento inteligente para disparos WhatsApp que:
- ✅ Agenda até 1000 disparos por dia
- ✅ Distribui mensagens aleatoriamente nas 24 horas
- ✅ Evita padrões mensais repetitivos
- ✅ Espaçamento mínimo de 60 segundos entre disparos
- ✅ Sistema de retentativas automáticas
- ✅ Tolerância de 1 minuto na execução

## 🏗️ Arquitetura

### Componentes

1. **Tabelas no Banco de Dados**
   - `scheduled_messages`: Armazena mensagens agendadas
   - `scheduler_logs`: Registra execuções e logs

2. **Edge Functions**
   - `message-scheduler`: Gera horários e cria agendamento
   - `message-dispatcher`: Executa disparos agendados (cron job)

3. **Interface React**
   - `CampaignScheduler`: Componente para gerenciar agendamentos

## 🚀 Configuração

### Passo 1: Habilitar Extensões no Supabase

Execute no SQL Editor do Supabase:

```sql
-- Habilitar pg_cron para agendamentos
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Habilitar pg_net para requisições HTTP
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### Passo 2: Configurar Cron Job

Execute no SQL Editor do Supabase (substitua `YOUR_SERVICE_KEY`):

```sql
SELECT cron.schedule(
  'dispatch-messages-every-minute',
  '* * * * *',  -- Executa a cada minuto
  $$
  SELECT net.http_post(
    url:='https://rcfmbjkolnzjhrlgrtda.supabase.co/functions/v1/message-dispatcher',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_KEY"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

### Passo 3: Obter Service Key

1. Vá para: **Project Settings** > **API** no Supabase Dashboard
2. Copie a **service_role key** (não a anon key!)
3. Substitua `YOUR_SERVICE_KEY` no SQL acima

### Passo 4: Verificar Cron Job

```sql
-- Listar cron jobs ativos
SELECT * FROM cron.job;

-- Ver últimas execuções
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;
```

## 📊 Como Usar

### Via Interface (Componente React)

1. Acesse o componente `CampaignScheduler`
2. Selecione a data desejada no calendário
3. Clique em "Criar Agendamento"
4. O sistema irá:
   - Buscar leads pendentes
   - Gerar 1000 horários randômicos
   - Criar mensagens agendadas

### Via API (Edge Function)

```javascript
const { data, error } = await supabase.functions.invoke('message-scheduler', {
  body: {
    userId: 'user-uuid',
    action: 'schedule',
    targetDate: '2025-10-07T00:00:00Z'  // Opcional
  }
});
```

## 🔄 Fluxo de Execução

### 1. Agendamento (Manual)
```
usuário → CampaignScheduler → message-scheduler
  ↓
gera 1000 timestamps randômicos
  ↓
insere em scheduled_messages (status: 'scheduled')
```

### 2. Disparo (Automático - Cron)
```
cron (a cada minuto) → message-dispatcher
  ↓
busca mensagens agendadas (±1 min tolerância)
  ↓
status: 'scheduled' → 'executing'
  ↓
envia via whatsapp-service
  ↓
sucesso: status → 'sent' | falha: status → 'retrying' ou 'failed'
```

## 🎲 Algoritmo de Randomização

### Características

- **Baseado em LCG (Linear Congruential Generator)**
- **Seed única**: `dia_do_mês * 1000 + mês * 100 + índice`
- **Offset aleatório**: -1, 0, ou +1 minuto por disparo
- **Garantia de heterogeneidade**: Mesmo horário não se repete em dias diferentes

### Exemplo

Para dia 7 (outubro):
- Lead 0: `baseMinute=0 + offset_randomico → 00:01`
- Lead 1: `baseMinute=1.44 + offset_randomico → 00:03`
- Lead 500: `baseMinute=720 + offset_randomico → 12:02`
- Lead 999: `baseMinute=1438 + offset_randomico → 23:59`

## 🔧 Tratamento de Falhas

### Retentativas

- **Max retries**: 3 tentativas por mensagem
- **Delay entre retentativas**: 5 minutos
- **Causas de falha**:
  - Número de telefone inválido
  - WhatsApp desconectado
  - Erro temporário da API

### Estados Possíveis

| Status | Descrição |
|--------|-----------|
| `scheduled` | Aguardando execução |
| `executing` | Em processo de envio |
| `sent` | Enviado com sucesso |
| `retrying` | Aguardando retentativa |
| `failed` | Falha após max retries |

## 📈 Monitoramento

### Via Banco de Dados

```sql
-- Estatísticas do dia
SELECT 
  status,
  COUNT(*) as total,
  MIN(scheduled_time) as primeiro,
  MAX(scheduled_time) as ultimo
FROM scheduled_messages
WHERE DATE(scheduled_time) = CURRENT_DATE
GROUP BY status;

-- Logs de execução
SELECT *
FROM scheduler_logs
ORDER BY created_at DESC
LIMIT 20;

-- Taxa de sucesso
SELECT 
  DATE(scheduled_time) as dia,
  COUNT(CASE WHEN status = 'sent' THEN 1 END) as enviados,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as falhas,
  ROUND(100.0 * COUNT(CASE WHEN status = 'sent' THEN 1 END) / COUNT(*), 2) as taxa_sucesso
FROM scheduled_messages
WHERE scheduled_time >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(scheduled_time)
ORDER BY dia DESC;
```

### Via Interface

O componente `CampaignScheduler` mostra:
- 📊 Total de mensagens agendadas
- ✅ Mensagens enviadas
- ❌ Mensagens com falha
- 📈 Estatísticas por dia

## ⚙️ Manutenção

### Limpar Mensagens Antigas

```sql
-- Deletar mensagens enviadas com mais de 30 dias
DELETE FROM scheduled_messages
WHERE status = 'sent'
AND executed_at < CURRENT_DATE - INTERVAL '30 days';

-- Deletar logs com mais de 60 dias
DELETE FROM scheduler_logs
WHERE created_at < CURRENT_DATE - INTERVAL '60 days';
```

### Pausar Cron Job

```sql
-- Desabilitar temporariamente
SELECT cron.unschedule('dispatch-messages-every-minute');

-- Reabilitar
-- Execute novamente o comando de schedule do Passo 2
```

## 🐛 Troubleshooting

### Mensagens não estão sendo disparadas

1. Verificar se cron job está ativo:
```sql
SELECT * FROM cron.job WHERE jobname = 'dispatch-messages-every-minute';
```

2. Verificar últimas execuções:
```sql
SELECT * FROM cron.job_run_details 
WHERE jobname = 'dispatch-messages-every-minute'
ORDER BY start_time DESC LIMIT 5;
```

3. Verificar logs do dispatcher:
```sql
SELECT * FROM scheduler_logs 
WHERE action = 'dispatch_executed'
ORDER BY created_at DESC LIMIT 10;
```

### Muitas falhas

1. Verificar configuração do WhatsApp
2. Verificar números de telefone inválidos:
```sql
SELECT phone_number, COUNT(*) as falhas
FROM scheduled_messages
WHERE status = 'failed'
GROUP BY phone_number
ORDER BY falhas DESC;
```

## 📝 Notas Importantes

- ⚠️ O cron job roda com **service_role** permissions - mantenha a key segura
- 🔒 Nunca commit a service key no código
- 📊 Monitore regularmente os logs de execução
- 🎯 Ajuste `BATCH_SIZE` no dispatcher conforme necessidade
- ⏱️ Tolerância de 1 minuto garante flexibilidade na execução

## 🔗 Recursos Adicionais

- [Supabase Cron Jobs](https://supabase.com/docs/guides/database/extensions/pg_cron)
- [pg_net HTTP Requests](https://supabase.com/docs/guides/database/extensions/pg_net)
- [Edge Functions](https://supabase.com/docs/guides/functions)

---

**Sistema desenvolvido para Leados-Infinity-Core**
Versão: 1.0.0 | Data: Outubro 2025