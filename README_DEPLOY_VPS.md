# 🚀 Deploy Rápido - VPS Hostinger

## 1. Instale Docker na VPS
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

## 2. Clone e Configure
```bash
git clone https://github.com/amos-fernandes/leados-infinity-core.git
cd leados-infinity-core
chmod +x deploy.sh
```

## 3. Execute Deploy
```bash
./deploy.sh
```

Aplicação disponível em: `http://seu-ip:8081`

## 🔥 Acessar Evolution Dashboard
1. Login na aplicação
2. Dashboard → Botão "Evolution API WhatsApp" (verde)
3. Adicionar instância Evolution API
4. Conectar via QR Code

## ✅ Funcionalidades Implementadas

### Backend (Edge Functions)
- ✅ `evolution-webhook` - Recebe webhooks da Evolution API
- ✅ `evolution-send-message` - Envia mensagens (texto/mídia)
- ✅ `evolution-manage-instance` - CRUD de instâncias

### Frontend (React)
- ✅ `EvolutionDashboard` - Gerenciamento de instâncias
- ✅ `EvolutionInstanceForm` - Formulário de configuração
- ✅ `EvolutionMessages` - Interface de chat

### Banco de Dados
- ✅ `evolution_instances` - Múltiplas instâncias WhatsApp
- ✅ `evolution_messages` - Histórico de mensagens
- ✅ `evolution_webhook_logs` - Logs de webhooks
- ✅ RLS Policies configuradas
- ✅ Realtime habilitado

### Integrações
- ✅ CRM - Mensagens vinculadas a leads automaticamente
- ✅ IA - Respostas automáticas via RAG Chat
- ✅ Webhooks - Configuração automática na Evolution

## 📱 URLs Importantes
- App: `http://seu-ip:8081`
- Webhook: `https://rcfmbjkolnzjhrlgrtda.supabase.co/functions/v1/evolution-webhook`
