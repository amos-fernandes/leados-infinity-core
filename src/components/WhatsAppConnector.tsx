import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  QrCode,
  Smartphone,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Power,
  PowerOff,
  Terminal,
  Wifi,
  WifiOff,
  User,
  Phone
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface LogEntry {
  message: string;
  logType: 'info' | 'success' | 'error';
  timestamp: string;
}

interface ConnectionStatus {
  status: 'DISCONNECTED' | 'CONNECTING' | 'PENDING_QR' | 'CONNECTED' | 'AUTH_FAILURE';
  data?: {
    sessionName?: string;
    phoneNumber?: string;
    userName?: string;
    connectedAt?: string;
  };
}

// Componente Emulador de Terminal
const TerminalEmulator = ({ logs }: { logs: LogEntry[] }) => {
  const endOfLogsRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    endOfLogsRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getLogColor = (logType: string) => {
    switch (logType) {
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      default: return 'text-blue-400';
    }
  };

  const getLogIcon = (logType: string) => {
    switch (logType) {
      case 'success': return <CheckCircle className="h-3 w-3 text-green-400" />;
      case 'error': return <AlertCircle className="h-3 w-3 text-red-400" />;
      default: return <AlertCircle className="h-3 w-3 text-blue-400" />;
    }
  };

  return (
    <div className="bg-slate-950 text-green-400 font-mono text-sm p-4 rounded-lg h-80 overflow-y-auto border border-slate-800">
      {logs.length === 0 ? (
        <div className="text-center text-slate-500 py-8">
          <Terminal className="h-8 w-8 mx-auto mb-2" />
          <p>Aguardando atividade...</p>
          <p className="text-xs mt-1">Os logs de conexão aparecerão aqui</p>
        </div>
      ) : (
        <div className="space-y-1">
          {logs.map((log, index) => (
            <div key={index} className="flex items-start gap-2">
              {getLogIcon(log.logType)}
              <span className="text-slate-400 text-xs">
                [{new Date(log.timestamp).toLocaleTimeString()}]
              </span>
              <span className={getLogColor(log.logType)}>
                {log.message}
              </span>
            </div>
          ))}
          <div ref={endOfLogsRef} />
        </div>
      )}
    </div>
  );
};

const WhatsAppConnector = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ status: 'DISCONNECTED' });
  // Initialize QR code as NULL for clearer verification
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const addLog = (message: string, logType: 'info' | 'success' | 'error' = 'info') => {
    const newLog: LogEntry = {
      message,
      logType,
      timestamp: new Date().toISOString()
    };
    setLogs(prev => [...prev, newLog]);
  };

  const connectWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const projectId = 'rcfmbjkolnzjhrlgrtda';
    const wsUrl = `wss://${projectId}.supabase.co/functions/v1/whatsapp-websocket`;
    
    console.log('Conectando WebSocket:', wsUrl);
    addLog('🔌 Estabelecendo conexão com servidor...', 'info');
    
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('WebSocket conectado');
      setWsConnected(true);
      addLog('✅ Conectado ao servidor Leados Infinity', 'success');
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message:', data);

        // Filtrar mensagens do usuário atual
        if (data.userId && data.userId !== user?.id) {
          return;
        }

        switch (data.type) {
          case 'whatsapp_log':
            addLog(data.message, data.logType);
            break;

          case 'whatsapp_qr':
            // --- PONTO DE VERIFICAÇÃO 3: Frontend recebendo QR Code ---
            console.log('=== QR CODE RECEBIDO DO BACKEND ===');
            console.log('QR Code URL:', data.qrCode);
            console.log('Usuário:', data.userId);
            console.log('Timestamp:', data.timestamp);
            
            if (data.qrCode && data.qrCode.trim() !== '') {
              console.log('✅ QR Code válido recebido, atualizando estado');
              setQrCode(data.qrCode);
              addLog('📱 QR Code recebido! Escaneie com o WhatsApp', 'success');
            } else {
              console.error('❌ QR Code recebido está vazio ou inválido:', data.qrCode);
              addLog('❌ Erro: QR Code inválido recebido', 'error');
            }
            break;

          case 'whatsapp_status_change':
            console.log('=== MUDANÇA DE STATUS ===');
            console.log('Novo status:', data.status);
            console.log('Data adicional:', data.data);
            
            setConnectionStatus({ 
              status: data.status,
              data: data.data
            });
            
            if (data.status === 'CONNECTED') {
              setQrCode(null); // Clear QR code after successful connection
              toast({
                title: "🎉 WhatsApp Conectado!",
                description: `Conectado como: ${data.data?.userName || data.data?.phoneNumber || 'Usuário'}`,
              });
            } else if (data.status === 'AUTH_FAILURE') {
              setQrCode(null); // Clear invalid QR code
              toast({
                title: "❌ Falha na Autenticação",
                description: "Por favor, gere um novo QR Code e tente novamente.",
                variant: "destructive"
              });
            }
            break;
        }
      } catch (error) {
        console.error('Erro ao processar mensagem WebSocket:', error);
        addLog('❌ Erro ao processar mensagem do servidor', 'error');
      }
    };

    wsRef.current.onclose = (event) => {
      console.log('WebSocket fechado:', event.code, event.reason);
      setWsConnected(false);
      addLog('🔌 Conexão com servidor perdida', 'error');
      
      // Auto reconnect
      if (connectionStatus.status !== 'DISCONNECTED') {
        setTimeout(() => {
          addLog('🔄 Tentando reconectar...', 'info');
          connectWebSocket();
        }, 3000);
      }
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      addLog('❌ Erro na conexão WebSocket', 'error');
    };
  };

  const sendWebSocketMessage = (message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('Enviando mensagem:', message);
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.error('WebSocket não conectado');
      addLog('❌ Conexão WebSocket não disponível', 'error');
      toast({
        title: "Erro de Conexão",
        description: "Não foi possível se conectar ao servidor",
        variant: "destructive"
      });
    }
  };

  const handleStartConnection = async () => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado",
        variant: "destructive"
      });
      return;
    }

    console.log('=== INICIANDO CONEXÃO WHATSAPP ===');
    console.log('Usuário:', user.id);
    console.log('Estado WebSocket:', wsRef.current?.readyState);

    // Limpar logs antigos e adicionar log inicial
    setLogs([]);
    setQrCode(null);
    setConnectionStatus({ status: 'CONNECTING' });
    
    // Conectar WebSocket se necessário
    connectWebSocket();
    
    // Log inicial para debug
    addLog('🚀 Iniciando processo de conexão WhatsApp...', 'info');
    
    // Aguardar conexão e enviar comando
    setTimeout(() => {
      console.log('Enviando comando de conexão via WebSocket...');
      sendWebSocketMessage({
        action: 'connect',
        userId: user.id
      });
    }, 1000);

    // Make REST call to initialize connection
    try {
      await supabase.functions.invoke('whatsapp-websocket', {
        body: { action: 'initialize', userId: user.id }
      });
      console.log('✅ Chamada REST enviada com sucesso');
    } catch (error) {
      console.error('❌ Erro na API REST:', error);
    }
  };

  const handleDisconnect = () => {
    console.log('=== DESCONECTANDO WHATSAPP ===');
    console.log('Usuário:', user?.id);
    
    sendWebSocketMessage({
      action: 'disconnect',
      userId: user?.id
    });
    
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    setConnectionStatus({ status: 'DISCONNECTED' });
    setQrCode(null); // Clear QR code properly
    setWsConnected(false);
    addLog('🔌 Desconectado do servidor', 'info');
    
    console.log('✅ Desconexão iniciada');
  };

  const handleRefreshStatus = () => {
    sendWebSocketMessage({
      action: 'status',
      userId: user?.id
    });
  };

  const getStatusBadge = () => {
    switch (connectionStatus.status) {
      case 'CONNECTED':
        return <Badge className="bg-green-500 text-white"><Wifi className="h-3 w-3 mr-1" />Conectado</Badge>;
      case 'CONNECTING':
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Conectando</Badge>;
      case 'PENDING_QR':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600"><QrCode className="h-3 w-3 mr-1" />Aguardando QR</Badge>;
      case 'AUTH_FAILURE':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Falha na Auth</Badge>;
      default:
        return <Badge variant="destructive"><WifiOff className="h-3 w-3 mr-1" />Desconectado</Badge>;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <div className="space-y-6 p-6">
      {/* Header com Status */}
      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-green-500" />
              Conector WhatsApp Business
            </div>
            {getStatusBadge()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Status WebSocket: {wsConnected ? '🟢 Conectado' : '🔴 Desconectado'}
              </p>
              {connectionStatus.data?.phoneNumber && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-3 w-3" />
                  <span className="font-medium">{connectionStatus.data.phoneNumber}</span>
                </div>
              )}
              {connectionStatus.data?.userName && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-3 w-3" />
                  <span className="font-medium">{connectionStatus.data.userName}</span>
                </div>
              )}
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRefreshStatus}
              disabled={connectionStatus.status === 'DISCONNECTED'}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* QR Code Area */}
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Autenticação WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            {/* --- LÓGICA DE RENDERIZAÇÃO CORRIGIDA --- */}
            {connectionStatus.status === 'CONNECTED' ? (
              <div className="py-8">
                <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-green-700 mb-2">✅ WhatsApp Conectado!</h3>
                <p className="text-muted-foreground mb-2">
                  {connectionStatus.data?.userName || 'Usuário conectado'}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  {connectionStatus.data?.phoneNumber}
                </p>
                {connectionStatus.data?.connectedAt && (
                  <p className="text-xs text-muted-foreground mb-4">
                    Conectado em: {new Date(connectionStatus.data.connectedAt).toLocaleString()}
                  </p>
                )}
                <Button 
                  onClick={handleDisconnect}
                  variant="destructive"
                  className="mt-4"
                >
                  <PowerOff className="h-4 w-4 mr-2" />
                  Desconectar
                </Button>
              </div>
            ) : connectionStatus.status === 'PENDING_QR' && qrCode ? (
              // 1. If we have valid QR code data, render the REAL QR Code
              <div className="py-4">
                <div className="bg-white p-6 rounded-lg border-2 border-dashed border-blue-300 inline-block mb-4">
                  {qrCode.startsWith('http') ? (
                    // If it's a URL (like QuickChart), display as image
                    <img 
                      src={qrCode} 
                      alt="QR Code WhatsApp" 
                      className="w-64 h-64 mx-auto"
                      onError={(e) => {
                        console.error('Erro ao carregar QR Code:', qrCode);
                        e.currentTarget.style.display = 'none';
                      }}
                      onLoad={() => {
                        console.log('✅ QR Code carregado com sucesso');
                      }}
                    />
                  ) : (
                    // If it's raw data, show as text for debugging
                    <div className="w-64 h-64 flex items-center justify-center bg-gray-50 rounded">
                      <div className="text-center">
                        <QrCode className="h-16 w-16 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">QR Code Data</p>
                        <code className="text-xs bg-gray-100 p-2 rounded mt-2 block max-w-60 overflow-hidden">
                          {qrCode.substring(0, 30)}...
                        </code>
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-lg">📱 Escaneie o QR Code</h4>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>1. Abra o WhatsApp no seu celular</p>
                    <p>2. Vá em Menu (⋮) → Dispositivos conectados</p>
                    <p>3. Toque em "Conectar dispositivo"</p>
                    <p>4. Escaneie o código acima</p>
                  </div>
                </div>
              </div>
            ) : connectionStatus.status === 'CONNECTING' ? (
              // 2. Loading state - generating QR code
              <div className="py-8">
                <Loader2 className="h-20 w-20 text-blue-500 mx-auto mb-4 animate-spin" />
                <h3 className="text-xl font-semibold mb-2">🚀 Estabelecendo Conexão</h3>
                <p className="text-muted-foreground">
                  {qrCode ? 'QR Code em processamento...' : 'Gerando QR Code, aguarde...'}
                </p>
              </div>
            ) : connectionStatus.status === 'AUTH_FAILURE' ? (
              // 3. Authentication failure state
              <div className="py-8">
                <AlertCircle className="h-20 w-20 text-red-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-red-700 mb-2">❌ Falha na Autenticação</h3>
                <p className="text-muted-foreground mb-4">
                  Não foi possível autenticar. Tente novamente.
                </p>
                <Button 
                  onClick={handleStartConnection}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar Novamente
                </Button>
              </div>
            ) : (
              // 4. Default disconnected state
              <div className="py-8">
                <QrCode className="h-20 w-20 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">WhatsApp Desconectado</h3>
                <p className="text-muted-foreground mb-4">
                  Clique no botão abaixo para iniciar a conexão
                </p>
                <Button 
                  onClick={handleStartConnection}
                  disabled={connectionStatus.status !== 'DISCONNECTED'}
                  className="bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  <Power className="h-5 w-5 mr-2" />
                  Iniciar Conexão WhatsApp
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Terminal de Logs */}
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Log de Atividades
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-4">
              <TerminalEmulator logs={logs} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Instruções */}
      <Card className="shadow-elegant">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <h4 className="font-medium mb-2">📋 Como conectar seu WhatsApp Business:</h4>
              <ol className="text-sm text-muted-foreground space-y-1 ml-4 list-decimal">
                <li>Clique em "Iniciar Conexão WhatsApp"</li>
                <li>Aguarde o sistema configurar o cliente</li>
                <li>Um QR Code será gerado automaticamente</li>
                <li>Abra o WhatsApp no seu celular</li>
                <li>Vá em Menu → Dispositivos conectados → Conectar dispositivo</li>
                <li>Escaneie o QR Code exibido na tela</li>
                <li>Aguarde a confirmação de conexão no log</li>
              </ol>
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  ℹ️ <strong>Nota:</strong> Esta versão usa um simulador para desenvolvimento. 
                  Em produção, a conexão será feita com o WhatsApp Web real.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppConnector;