# Configuração do Scheduler para Importação Matinal de Leads

## Visão Geral
Este documento descreve como configurar a importação automática de leads do basededados.org todas as manhãs às 6h.

## Pré-requisitos
- Acesso ao Lovable Cloud Backend
- Token da basededados.org configurado
- Extensões `pg_cron` e `pg_net` habilitadas

## Passo 1: Habilitar Extensões no Supabase

Execute estes comandos SQL no Lovable Cloud Backend:

```sql
-- Habilitar pg_cron para agendamento
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Habilitar pg_net para chamadas HTTP
CREATE EXTENSION IF NOT EXISTS pg_net;
```

## Passo 2: Criar o Cron Job

Execute este comando SQL para criar o job que roda todo dia às 6h (horário de Brasília - UTC-3):

```sql
-- Importar leads todo dia às 6h BRT (9h UTC)
SELECT cron.schedule(
  'import-leads-daily',
  '0 9 * * *', -- 9h UTC = 6h BRT
  $$
  SELECT net.http_post(
    url := 'https://rcfmbjkolnzjhrlgrtda.supabase.co/functions/v1/basededados-import',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjZm1iamtvbG56amhybGdydGRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1NDE5NDEsImV4cCI6MjA3NDExNzk0MX0.By9dvWq3J93hqcgFl3GaWC8oxTejOmxbHqBt4zzAOVI'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

## Passo 3: Verificar Jobs Agendados

Para ver todos os jobs agendados:

```sql
SELECT * FROM cron.job;
```

## Passo 4: Verificar Execuções

Para ver o histórico de execuções:

```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'import-leads-daily')
ORDER BY start_time DESC 
LIMIT 10;
```

## Gerenciamento do Scheduler

### Pausar o Job
```sql
SELECT cron.unschedule('import-leads-daily');
```

### Reativar o Job
Execute novamente o comando do Passo 2.

### Executar Manualmente
Para testar a importação imediatamente:

```bash
curl -X POST https://rcfmbjkolnzjhrlgrtda.supabase.co/functions/v1/basededados-import \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjZm1iamtvbG56amhybGdydGRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1NDE5NDEsImV4cCI6MjA3NDExNzk0MX0.By9dvWq3J93hqcgFl3GaWC8oxTejOmxbHqBt4zzAOVI" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Ajustar Horário

Para mudar o horário de execução, edite a expressão cron:

- `0 9 * * *` = 6h BRT (9h UTC)
- `0 12 * * *` = 9h BRT (12h UTC)
- `0 6 * * *` = 3h BRT (6h UTC)

Formato: `minuto hora dia_do_mês mês dia_da_semana`

## Monitoramento

### Ver Últimas Importações
```sql
SELECT 
  created_at,
  COUNT(*) as total_leads
FROM leads 
WHERE DATE(created_at) = CURRENT_DATE
GROUP BY created_at
ORDER BY created_at DESC;
```

### Alertas por Email

Configure alertas no N8N para ser notificado quando:
- A importação falhar
- Nenhum lead for importado
- Mais de X leads forem importados

## Troubleshooting

### Job não está executando
1. Verifique se as extensões estão habilitadas
2. Verifique os logs: `SELECT * FROM cron.job_run_details`
3. Verifique se o token da basededados.org está válido

### Leads duplicados
- O sistema já tem validação de CNPJ único
- Verifique RLS policies

### Performance
- O job processa até 1000 empresas por execução
- Ajuste o LIMIT na query se necessário

## Integração com N8N

O job pode disparar um workflow no N8N após a importação:

1. Crie um webhook no N8N
2. Configure a URL no edge function `basededados-import`
3. O N8N receberá notificação com o número de leads importados

## Próximos Passos

1. ✅ Configurar cron job
2. ✅ Testar execução manual
3. ✅ Verificar importação no dia seguinte
4. Configure alertas no N8N
5. Ajuste filtros de empresas conforme necessário
