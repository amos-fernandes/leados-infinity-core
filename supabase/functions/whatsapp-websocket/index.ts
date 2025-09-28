import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simulador de WhatsApp-Web.js Manager
class WhatsAppSessionManager {
  private sessions: Map<string, any> = new Map();
  private socket: WebSocket;

  constructor(socket: WebSocket) {
    this.socket = socket;
  }

  private sendLog(userId: string, message: string, type: 'info' | 'success' | 'error' = 'info') {
    const logMessage = {
      type: 'whatsapp_log',
      message,
      logType: type,
      timestamp: new Date().toISOString(),
      userId
    };
    
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(logMessage));
    }
  }

  private sendQRCode(userId: string, qrCode: string) {
    const qrMessage = {
      type: 'whatsapp_qr',
      qrCode,
      timestamp: new Date().toISOString(),
      userId
    };
    
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(qrMessage));
    }
  }

  private sendStatusChange(userId: string, status: string, data?: any) {
    const statusMessage = {
      type: 'whatsapp_status_change',
      status,
      data,
      timestamp: new Date().toISOString(),
      userId
    };
    
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(statusMessage));
    }
  }

  async startConnection(userId: string): Promise<void> {
    if (this.sessions.has(userId)) {
      this.sendLog(userId, 'Sessão já existente. Tentando obter status...', 'info');
      return;
    }

    this.sendLog(userId, '🚀 Iniciando cliente do WhatsApp...', 'info');
    this.sendStatusChange(userId, 'CONNECTING');

    // Simular processo de inicialização
    setTimeout(() => {
      this.sendLog(userId, '🔧 Configurando autenticação local...', 'info');
    }, 500);

    setTimeout(() => {
      this.sendLog(userId, '📱 Aguardando QR Code...', 'info');
    }, 1000);

    // Simular geração de QR Code
    setTimeout(() => {
      const qrData = this.generateQRCode(userId);
      this.sendLog(userId, '📋 QR Code gerado! Escaneie com seu WhatsApp.', 'success');
      this.sendQRCode(userId, qrData);
      this.sendStatusChange(userId, 'PENDING_QR');
      
      // Simular escaneamento após 15 segundos
      setTimeout(() => {
        this.simulateAuthentication(userId);
      }, 15000);
    }, 1500);

    // Registrar sessão
    this.sessions.set(userId, {
      status: 'CONNECTING',
      startTime: new Date(),
      sessionId: `session_${userId}_${Date.now()}`
    });
  }

  private generateQRCode(userId: string): string {
    // Em produção, aqui seria o QR code real do WhatsApp Web
    // Para desenvolvimento, retornamos uma URL de teste
    return `https://wa.me/qr/DEMO_${userId}_${Date.now()}`;
  }

  private simulateAuthentication(userId: string) {
    this.sendLog(userId, '🔐 Autenticação em andamento...', 'info');
    
    setTimeout(() => {
      this.sendLog(userId, '✅ Autenticação realizada com sucesso!', 'success');
    }, 2000);

    setTimeout(() => {
      this.sendLog(userId, '🔄 Sincronizando conversas...', 'info');
    }, 3000);

    setTimeout(() => {
      this.sendLog(userId, '📞 Conectando ao servidor do WhatsApp...', 'info');
    }, 4000);

    setTimeout(() => {
      this.sendLog(userId, '✅ Cliente do WhatsApp está pronto e conectado!', 'success');
      this.sendStatusChange(userId, 'CONNECTED', {
        sessionName: `WhatsApp_${userId}`,
        phoneNumber: '+55 (62) 99999-9999',
        connectedAt: new Date().toISOString(),
        userName: 'Usuário Demo'
      });

      // Atualizar sessão
      const session = this.sessions.get(userId);
      if (session) {
        session.status = 'CONNECTED';
        session.connectedAt = new Date();
      }
    }, 5500);
  }

  disconnectSession(userId: string) {
    if (this.sessions.has(userId)) {
      this.sendLog(userId, '🔌 Desconectando sessão WhatsApp...', 'info');
      this.sessions.delete(userId);
      
      setTimeout(() => {
        this.sendLog(userId, '✅ Sessão desconectada com sucesso!', 'success');
        this.sendStatusChange(userId, 'DISCONNECTED');
      }, 1000);
    }
  }

  getSessionStatus(userId: string) {
    const session = this.sessions.get(userId);
    if (session) {
      this.sendLog(userId, `📊 Status da sessão: ${session.status}`, 'info');
      this.sendStatusChange(userId, session.status, session);
    } else {
      this.sendLog(userId, '❌ Nenhuma sessão ativa encontrada', 'error');
      this.sendStatusChange(userId, 'DISCONNECTED');
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Request must be a WebSocket upgrade", { 
      status: 400,
      headers: corsHeaders 
    });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Criar instância do gerenciador de sessões
  const whatsappManager = new WhatsAppSessionManager(socket);

  let userId: string | null = null;

  const sendLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const logMessage = {
      type: 'whatsapp_log',
      message,
      logType: type,
      timestamp: new Date().toISOString()
    };
    
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(logMessage));
    }
  };

  socket.onopen = () => {
    console.log('WebSocket connection established');
    sendLog('🌐 Conexão WebSocket estabelecida com sucesso!', 'success');
  };

  socket.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('WebSocket message received:', data);

      userId = data.userId || userId;

      switch (data.action) {
        case 'connect':
          if (!userId) {
            sendLog('❌ Erro: ID do usuário não fornecido', 'error');
            return;
          }
          
          sendLog('🚀 Iniciando processo de conexão...', 'info');
          await whatsappManager.startConnection(userId);
          
          // Salvar no banco de dados
          if (userId) {
            try {
              await supabase
                .from('whatsapp_config')
                .upsert({
                  user_id: userId,
                  phone_number: `demo_${userId}`,
                  webhook_url: `${supabaseUrl}/functions/v1/whatsapp-websocket`,
                  access_token: 'demo_token',
                  is_active: false,
                  business_account_id: `session_${userId}`,
                  updated_at: new Date().toISOString()
                });

              await supabase
                .from('campaign_knowledge')
                .insert({
                  user_id: userId,
                  content: `WhatsApp connection initiated - Demo Mode - Session: session_${userId}`,
                  generated_at: new Date().toISOString()
                });
            } catch (dbError) {
              console.error('Database error:', dbError);
            }
          }
          break;

        case 'disconnect':
          if (!userId) {
            sendLog('❌ Erro: ID do usuário não fornecido', 'error');
            return;
          }
          
          whatsappManager.disconnectSession(userId);
          
          if (userId) {
            try {
              await supabase
                .from('whatsapp_config')
                .update({ 
                  is_active: false,
                  updated_at: new Date().toISOString()
                })
                .eq('user_id', userId);
            } catch (dbError) {
              console.error('Database error:', dbError);
            }
          }
          break;

        case 'status':
          if (!userId) {
            sendLog('❌ Erro: ID do usuário não fornecido', 'error');
            return;
          }
          
          whatsappManager.getSessionStatus(userId);
          break;

        default:
          sendLog(`❌ Ação desconhecida: ${data.action}`, 'error');
      }

    } catch (error) {
      console.error('WebSocket message error:', error);
      sendLog(`❌ Erro no processamento: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 'error');
    }
  };

  socket.onclose = () => {
    console.log('WebSocket connection closed');
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  return response;
});