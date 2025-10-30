# Guia de Integração Completo - Leados Infinity Core

## 🎯 Visão Geral do Fluxo

```
┌─────────────────┐
│  BaseDados.org  │ (Importação Matinal 6h)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Leados CRM    │ (Armazena Leads)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Evolution API  │ (Disparo WhatsApp)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Webhooks      │ (Respostas)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Leados CRM     │ (Registro de Interações)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│      N8N        │ (Automações)
└─────────────────┘
```

## 📋 Checklist de Configuração

### 1. Credenciais Configuradas ✅
- [x] HOSTINGER_TOKEN
- [x] N8N_API_KEY
- [x] EVOLUTION_AUTHENTICATION_KEY
- [x] BASEDEDADOS_ORG_TOKEN

### 2. Instâncias Evolution API

#### Configurar Nova Instância

1. Acesse o dashboard Evolution
2. Clique em "Nova Instância"
3. Preencha:
   - **Nome**: ConsultorN (ex: Consultor1, Consultor2)
   - **URL**: https://sua-evolution-api.com
   - **API Key**: Sua chave da Evolution API

4. Conecte via QR Code
5. Aguarde status "Conectado"

#### URL do Webhook

Configure este webhook em cada instância da Evolution API:

```
https://rcfmbjkolnzjhrlgrtda.supabase.co/functions/v1/evolution-webhook
```

Headers necessários:
```
Content-Type: application/json
```

### 3. Automação Matinal (6h BRT)

A importação de leads roda automaticamente todo dia às 6h da manhã.

Para configurar o scheduler:

```sql
-- Execute no Supabase SQL Editor
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

### 4. Configuração N8N

#### Webhook para Receber Notificações

URL do webhook N8N:
```
https://seu-n8n.com/webhook/leados-notifications
```

#### Workflows Recomendados

**Workflow 1: Distribuição de Leads**
- Trigger: Novos leads importados
- Ação: Distribuir entre consultores
- Envio: Disparar mensagens via Evolution

**Workflow 2: Follow-up Automático**
- Trigger: Lead sem resposta por 24h
- Ação: Enviar mensagem de follow-up
- Canal: WhatsApp via Evolution

**Workflow 3: Qualificação Automática**
- Trigger: Resposta recebida no WhatsApp
- Ação: Analisar com IA (Lovable AI)
- Resultado: Atualizar score do lead

### 5. Dashboard Evolution

O dashboard mostra:

#### Aba Instâncias
- Lista todas as instâncias configuradas
- Status de conexão em tempo real
- QR Code para conexão
- Gerenciamento de instâncias

#### Aba Mensagens
- Histórico completo de conversas
- Mensagens enviadas e recebidas
- Status de leitura
- Envio de novas mensagens

#### Aba Estatísticas
- Total de instâncias
- Mensagens enviadas hoje
- Taxa de resposta
- Leads gerados via WhatsApp

#### Aba Logs
- Histórico de eventos
- Webhooks recebidos
- Erros e avisos
- Debug de integração

## 🔄 Fluxo Detalhado

### 1. Importação Matinal (6h BRT)

```typescript
// Automático via cron job
basededados.org → Buscar empresas abertas ontem
                → Filtrar (excluir MEI)
                → Inserir no CRM como leads
                → Notificar N8N
```

### 2. Disparo de Campanha

```typescript
// Manual ou via N8N
Dashboard → Selecionar leads
         → Escolher instância Evolution
         → Enviar mensagens
         → Registrar no histórico
```

### 3. Recebimento de Resposta

```typescript
// Automático via webhook
WhatsApp → Evolution API → Webhook
                         → Salvar mensagem
                         → Criar/atualizar lead
                         → Processar com IA (RAG)
                         → Responder automaticamente
                         → Registrar interação no CRM
```

### 4. Qualificação e Follow-up

```typescript
// Via N8N + Lovable AI
Interação → Analisar sentimento
         → Calcular score BANT
         → Atualizar lead
         → Agendar follow-up se necessário
```

## 🛠️ Ferramentas Disponíveis

### Edge Functions

1. **basededados-import**
   - Importa leads do basededados.org
   - Roda automaticamente às 6h
   - Filtra empresas por critérios

2. **evolution-webhook**
   - Recebe eventos da Evolution API
   - Processa mensagens
   - Integra com CRM

3. **evolution-send-message**
   - Envia mensagens via Evolution
   - Suporta múltiplas instâncias
   - Trata erros e retries

4. **evolution-manage-instance**
   - Gerencia instâncias
   - Gera QR Code
   - Verifica status

5. **n8n-webhook**
   - Recebe comandos do N8N
   - Executa ações no CRM
   - Dispara campanhas

### Componentes React

1. **EvolutionDashboard**
   - Dashboard principal
   - Gerenciamento de instâncias
   - Estatísticas e métricas

2. **EvolutionInstanceForm**
   - Adicionar/editar instâncias
   - Configuração de API keys
   - Validação de conexão

3. **EvolutionMessages**
   - Chat completo
   - Histórico de mensagens
   - Envio de mensagens

## 📊 Monitoramento

### Verificar Importação de Leads

```sql
-- Leads importados hoje
SELECT COUNT(*) 
FROM leads 
WHERE DATE(created_at) = CURRENT_DATE;

-- Últimas importações
SELECT 
  DATE(created_at) as data,
  COUNT(*) as total
FROM leads 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY data DESC;
```

### Verificar Mensagens Evolution

```sql
-- Mensagens hoje por instância
SELECT 
  ei.instance_name,
  COUNT(*) as total_mensagens,
  COUNT(CASE WHEN from_me THEN 1 END) as enviadas,
  COUNT(CASE WHEN NOT from_me THEN 1 END) as recebidas
FROM evolution_messages em
JOIN evolution_instances ei ON em.instance_id = ei.id
WHERE DATE(em.timestamp) = CURRENT_DATE
GROUP BY ei.instance_name;
```

### Verificar Webhooks

```sql
-- Últimos webhooks recebidos
SELECT 
  event_type,
  processed,
  created_at
FROM evolution_webhook_logs
ORDER BY created_at DESC
LIMIT 20;
```

## 🚨 Troubleshooting

### Problema: Leads não estão sendo importados

**Solução:**
1. Verificar se o cron job está ativo:
```sql
SELECT * FROM cron.job WHERE jobname = 'import-leads-daily';
```

2. Verificar token basededados.org
3. Ver logs da função:
```bash
# No Lovable Cloud backend, veja logs da função basededados-import
```

### Problema: Mensagens não estão chegando no CRM

**Solução:**
1. Verificar webhook configurado na Evolution API
2. Ver logs do webhook:
```sql
SELECT * FROM evolution_webhook_logs 
WHERE processed = false 
ORDER BY created_at DESC;
```

3. Verificar instância conectada:
```sql
SELECT * FROM evolution_instances WHERE status != 'connected';
```

### Problema: QR Code não aparece

**Solução:**
1. Verificar API Key da Evolution
2. Verificar URL da instância
3. Ver logs do navegador
4. Tentar recriar a instância

## 📈 Próximos Passos

1. ✅ Configurar todas as instâncias Evolution
2. ✅ Ativar automação matinal
3. ✅ Criar workflows no N8N
4. Configure alertas de falha
5. Monitore métricas diariamente
6. Ajuste filtros de leads conforme necessário
7. Implemente relatórios personalizados

## 🔗 Links Úteis

- Dashboard Evolution: Ver no menu lateral "Evolution API"
- Backend: Use o botão "View Backend" no chat
- Logs: Disponíveis no dashboard Evolution, aba "Logs"
- Suporte: Contate via sistema

## 💡 Dicas de Uso

1. **Nomeie as instâncias**: Use nomes claros como "Consultor1", "Consultor2"
2. **Monitore diariamente**: Verifique o dashboard todas as manhãs
3. **Configure alertas**: Use N8N para ser notificado de problemas
4. **Teste regularmente**: Envie mensagens de teste para verificar funcionamento
5. **Documente alterações**: Mantenha registro de configurações

## 🎓 Capacitação da Equipe

### Para Consultores
- Como usar o dashboard Evolution
- Como responder mensagens
- Como qualificar leads

### Para Administradores
- Gerenciar instâncias
- Configurar automações
- Monitorar performance

### Para TI
- Deploy na VPS
- Troubleshooting
- Backups e segurança
