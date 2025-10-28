# 🚀 Deploy LeadOS Infinity + Evolution API na VPS Hostinger

## 📋 Pré-requisitos

- VPS Hostinger KVM2 com Ubuntu/Debian
- Docker e Docker Compose instalados
- Instância Evolution API rodando (local ou remota)
- Acesso SSH à VPS

## 🔧 Configuração

### 1. Clone o repositório na VPS

```bash
cd /root
git clone https://github.com/amos-fernandes/leados-infinity-core.git
cd leados-infinity-core
```

### 2. Configure variáveis de ambiente

Edite o arquivo `.env.docker` com suas credenciais:

```bash
VITE_SUPABASE_PROJECT_ID=rcfmbjkolnzjhrlgrtda
VITE_SUPABASE_PUBLISHABLE_KEY=sua_key_aqui
VITE_SUPABASE_URL=https://rcfmbjkolnzjhrlgrtda.supabase.co
```

### 3. Deploy da aplicação

```bash
chmod +x deploy.sh
./deploy.sh
```

A aplicação estará disponível em `http://seu-ip:8081`

## 📱 Configurar Evolution API

### 1. Acesse o Dashboard Evolution

- Faça login na aplicação
- Clique em **"Evolution API WhatsApp"** no dashboard
- Clique em **"Nova Instância"**

### 2. Adicione sua instância

Preencha os dados:
- **Nome**: consultor1, consultor2, etc.
- **URL da Evolution API**: https://sua-evolution-api.com
- **API Key**: Sua chave de API

### 3. Conecte o WhatsApp

1. Clique em **"Conectar"** na instância
2. Escaneie o QR Code com WhatsApp
3. Aguarde status mudar para **"Conectado"**

## 🔄 Webhooks Automáticos

Os webhooks são configurados automaticamente quando você cria uma instância. A URL do webhook é:

```
https://rcfmbjkolnzjhrlgrtda.supabase.co/functions/v1/evolution-webhook
```

### Eventos suportados:
- ✅ Mensagens recebidas → Salvas no CRM + Resposta IA automática
- ✅ Status de mensagens (enviado/lido)
- ✅ Chamadas recebidas → Registradas no CRM
- ✅ QR Code atualizado
- ✅ Status de conexão

## 💬 Funcionalidades

### Múltiplas Instâncias
- Gerencie vários WhatsApp simultaneamente
- Cada instância pode ter um consultor responsável
- Status em tempo real de cada conexão

### Integração CRM
- Mensagens automaticamente vinculadas a leads
- Criação automática de leads para novos contatos
- Histórico completo de interações

### IA Automática
- Respostas automáticas via RAG Chat
- Contexto baseado na base de conhecimento
- Integração com Gemini AI

### Envio de Mensagens
- Texto, imagens, vídeos, áudios, documentos
- Status de entrega em tempo real
- Interface de chat intuitiva

## 🔐 Segurança

- API Keys criptografadas no Supabase
- RLS (Row Level Security) ativado
- Webhooks validados por instância
- Autenticação obrigatória

## 🛠️ Comandos Úteis

### Ver logs
```bash
docker-compose --env-file .env.docker logs -f
```

### Parar containers
```bash
docker-compose --env-file .env.docker down
```

### Rebuild completo
```bash
./deploy.sh
```

### Ver status
```bash
docker-compose --env-file .env.docker ps
```

## 📊 Monitoramento

Acesse o dashboard para monitorar:
- Status de todas as instâncias
- Mensagens em tempo real
- Logs de webhook
- Integração com CRM

## 🆘 Troubleshooting

### QR Code não aparece
- Verifique se a Evolution API está acessível
- Confirme a API Key está correta
- Veja logs: `docker logs sdr-app`

### Mensagens não chegam
- Verifique webhook configurado na Evolution
- Confirme instância está "Conectada"
- Veja logs de webhook no dashboard

### Porta 8080 em uso
A aplicação usa porta 8081 por padrão. Para mudar:
```yaml
# docker-compose.yml
ports:
  - "NOVA_PORTA:8080"
```

## 📞 Suporte

Sistema completo de SDR automatizado com Evolution API integrada ao CRM LeadOS Infinity.

**Developed by LeadOS Team**
