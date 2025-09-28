import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  
  const WPPCONNECT_URL = Deno.env.get('WPPCONNECT_URL') || 'http://localhost:21234';
  const WPPCONNECT_TOKEN = Deno.env.get('WPPCONNECT_TOKEN') || 'your_secure_token_here';

  let userId: string | null = null;
  let sessionName: string | null = null;

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

  const sendStatus = (status: string, data?: any) => {
    const statusMessage = {
      type: 'whatsapp_status_change',
      status,
      data,
      timestamp: new Date().toISOString()
    };
    
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(statusMessage));
    }
  };

  const sendQRCode = (qrCode: string) => {
    const qrMessage = {
      type: 'whatsapp_qr',
      qrCode,
      timestamp: new Date().toISOString()
    };
    
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(qrMessage));
    }
  };

  socket.onopen = () => {
    console.log('WebSocket connection established');
    sendLog('Conexão WebSocket estabelecida', 'success');
  };

  socket.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('WebSocket message received:', data);

      switch (data.action) {
        case 'connect':
          userId = data.userId;
          sessionName = `session_${userId?.slice(0, 8)}`;
          
          sendLog('Iniciando conexão WhatsApp...', 'info');
          sendStatus('CONNECTING');

          try {
            sendLog('Configurando servidor WppConnect...', 'info');
            
            // Tentar conectar ao WppConnect
            const wppResponse = await fetch(`${WPPCONNECT_URL}/api/${sessionName}/connect`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${WPPCONNECT_TOKEN}`,
              },
              body: JSON.stringify({
                webhook: `${supabaseUrl}/functions/v1/wppconnect-webhook`,
                waitQrCode: true
              })
            });

            const wppResult = await wppResponse.json();
            console.log('WppConnect response:', wppResult);

            if (!wppResponse.ok) {
              throw new Error(`WppConnect error: ${wppResult.message || 'Erro de conexão'}`);
            }

            if (wppResult.qrcode) {
              sendLog('QR Code gerado! Escaneie com seu WhatsApp.', 'success');
              sendQRCode(wppResult.qrcode);
              sendStatus('PENDING_QR');
              
              // Monitorar status da conexão
              setTimeout(() => checkConnectionStatus(sessionName!), 5000);
            } else if (wppResult.status === 'CONNECTED' || wppResult.connected) {
              sendLog('WhatsApp já conectado!', 'success');
              sendStatus('CONNECTED', { 
                sessionName,
                phoneNumber: wppResult.phone || sessionName
              });
            }

            // Atualizar banco de dados
            if (userId) {
              await supabase
                .from('whatsapp_config')
                .upsert({
                  user_id: userId,
                  phone_number: sessionName,
                  webhook_url: `${supabaseUrl}/functions/v1/wppconnect-webhook`,
                  access_token: WPPCONNECT_TOKEN,
                  is_active: wppResult.status === 'CONNECTED' || wppResult.connected || false,
                  business_account_id: sessionName,
                  updated_at: new Date().toISOString()
                });

              await supabase
                .from('campaign_knowledge')
                .insert({
                  user_id: userId,
                  content: `WhatsApp connection attempt - Session: ${sessionName} - Status: ${wppResult.status || 'initiated'}`,
                  generated_at: new Date().toISOString()
                });
            }

          } catch (wppError) {
            console.error('WppConnect connection failed:', wppError);
            sendLog(`Erro na conexão: ${wppError instanceof Error ? wppError.message : 'Erro desconhecido'}`, 'error');
            
            // Fallback - simular conexão para desenvolvimento
            sendLog('Iniciando modo de desenvolvimento...', 'info');
            sendLog('WppConnect não disponível. Usando modo simulado.', 'info');
            
            // Gerar QR code válido para teste (texto simples que pode ser escaneado)
            const testQR = `https://wa.me/qr/TEST_${Date.now()}`;
            
            setTimeout(() => {
              sendLog('QR Code de teste gerado', 'info');
              sendLog('ATENÇÃO: Este é um QR code simulado para desenvolvimento', 'info');
              sendLog('Para uso em produção, configure o WppConnect adequadamente', 'info');
              sendQRCode(testQR);
              sendStatus('PENDING_QR');
              
              // Simular conexão após 10 segundos
              setTimeout(() => {
                sendLog('Simulação: Conexão estabelecida (modo desenvolvimento)', 'success');
                sendStatus('CONNECTED', { 
                  sessionName: sessionName || 'dev_session',
                  phoneNumber: '+55 62 99999-9999 (SIMULADO)'
                });
              }, 10000);
            }, 1000);
          }
          break;

        case 'disconnect':
          if (sessionName) {
            try {
              sendLog('Desconectando WhatsApp...', 'info');
              
              await fetch(`${WPPCONNECT_URL}/api/${sessionName}/close-session`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${WPPCONNECT_TOKEN}`,
                }
              });

              sendLog('WhatsApp desconectado com sucesso!', 'success');
              sendStatus('DISCONNECTED');

              if (userId) {
                await supabase
                  .from('whatsapp_config')
                  .update({ 
                    is_active: false,
                    updated_at: new Date().toISOString()
                  })
                  .eq('user_id', userId);
              }
            } catch (error) {
              sendLog('Erro ao desconectar. Sessão finalizada localmente.', 'error');
              sendStatus('DISCONNECTED');
            }
          }
          break;

        case 'status':
          if (sessionName) {
            await checkConnectionStatus(sessionName);
          }
          break;

        default:
          sendLog(`Ação desconhecida: ${data.action}`, 'error');
      }

    } catch (error) {
      console.error('WebSocket message error:', error);
      sendLog(`Erro no processamento: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 'error');
    }
  };

  const checkConnectionStatus = async (session: string) => {
    try {
      const statusResponse = await fetch(`${WPPCONNECT_URL}/api/${session}/status`, {
        headers: {
          'Authorization': `Bearer ${WPPCONNECT_TOKEN}`,
        }
      });

      if (statusResponse.ok) {
        const statusResult = await statusResponse.json();
        console.log('Status check result:', statusResult);

        if (statusResult.status === 'CONNECTED' || statusResult.connected) {
          sendLog('Autenticação concluída! WhatsApp conectado.', 'success');
          sendStatus('CONNECTED', {
            sessionName: session,
            phoneNumber: statusResult.phone || session
          });
        } else if (statusResult.status === 'DISCONNECTED') {
          sendLog('Aguardando escaneamento do QR Code...', 'info');
          // Continue checking
          setTimeout(() => checkConnectionStatus(session), 3000);
        }
      }
    } catch (error) {
      console.log('Status check failed, will retry...', error);
      setTimeout(() => checkConnectionStatus(session), 5000);
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