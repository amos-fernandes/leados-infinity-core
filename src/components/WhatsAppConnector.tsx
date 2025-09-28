import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
  WifiOff
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";

interface LogEntry {
  message: string;
  logType: 'info' | 'success' | 'error';
  timestamp: string;
}

interface ConnectionStatus {
  status: 'DISCONNECTED' | 'CONNECTING' | 'PENDING_QR' | 'CONNECTED';
  data?: {
    sessionName?: string;
    phoneNumber?: string;
  };
}

const WhatsAppConnector = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ status: 'DISCONNECTED' });
  const [qrCode, setQrCode] = useState<string>('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

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

    const projectId = 'rcfmbjkolnzjhrlgrtda'; // From env
    const wsUrl = `wss://${projectId}.supabase.co/functions/v1/whatsapp-websocket`;
    
    console.log('Tentando conectar WebSocket:', wsUrl);
    addLog('Conectando ao servidor...', 'info');
    
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('WebSocket conectado com sucesso');
      setWsConnected(true);
      addLog('Conexão com servidor estabelecida', 'success');
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message:', data);

        switch (data.type) {
          case 'whatsapp_log':
            addLog(data.message, data.logType);
            break;

          case 'whatsapp_qr':
            setQrCode(data.qrCode);
            break;

          case 'whatsapp_status_change':
            setConnectionStatus({ 
              status: data.status,
              data: data.data
            });
            
            if (data.status === 'CONNECTED') {
              setQrCode(''); // Clear QR code when connected
              toast({
                title: "WhatsApp Conectado!",
                description: `Conectado como: ${data.data?.phoneNumber || 'Usuário'}`,
              });
            }
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        addLog('Erro ao processar mensagem do servidor', 'error');
      }
    };

    wsRef.current.onclose = (event) => {
      console.log('WebSocket fechado:', event.code, event.reason);
      setWsConnected(false);
      addLog('Conexão com servidor perdida', 'error');
      
      // Auto reconnect after 5 seconds
      setTimeout(() => {
        if (connectionStatus.status !== 'DISCONNECTED') {
          console.log('Tentando reconectar WebSocket...');
          connectWebSocket();
        }
      }, 5000);
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      addLog('Erro na conexão WebSocket', 'error');
    };
  };

  const sendWebSocketMessage = (message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('Enviando mensagem WebSocket:', message);
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.error('WebSocket não conectado. ReadyState:', wsRef.current?.readyState);
      addLog('Conexão WebSocket não disponível', 'error');
      toast({
        title: "Erro de Conexão",
        description: "Não foi possível se conectar ao servidor",
        variant: "destructive"
      });
    }
  };

  const handleConnect = () => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado",
        variant: "destructive"
      });
      return;
    }

    setLogs([]); // Clear previous logs
    setQrCode('');
    setConnectionStatus({ status: 'CONNECTING' });
    
    connectWebSocket();
    
    // Wait a moment for WebSocket to connect, then send connect message
    setTimeout(() => {
      sendWebSocketMessage({
        action: 'connect',
        userId: user.id
      });
    }, 1000);
  };

  const handleDisconnect = () => {
    sendWebSocketMessage({
      action: 'disconnect'
    });
    
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    setConnectionStatus({ status: 'DISCONNECTED' });
    setQrCode('');
    setWsConnected(false);
  };

  const handleRefresh = () => {
    sendWebSocketMessage({
      action: 'status'
    });
  };

  const getStatusBadge = () => {
    switch (connectionStatus.status) {
      case 'CONNECTED':
        return <Badge className="bg-green-500 text-white"><Wifi className="h-3 w-3 mr-1" />Conectado</Badge>;
      case 'CONNECTING':
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Conectando</Badge>;
      case 'PENDING_QR':
        return <Badge variant="outline"><QrCode className="h-3 w-3 mr-1" />Aguardando QR</Badge>;
      default:
        return <Badge variant="destructive"><WifiOff className="h-3 w-3 mr-1" />Desconectado</Badge>;
    }
  };

  const getLogIcon = (logType: string) => {
    switch (logType) {
      case 'success': return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'error': return <AlertCircle className="h-3 w-3 text-red-500" />;
      default: return <AlertCircle className="h-3 w-3 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Header */}
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
                Status da conexão WebSocket: {wsConnected ? 'Conectado' : 'Desconectado'}
              </p>
              {connectionStatus.data?.phoneNumber && (
                <p className="text-sm font-medium">
                  Número: {connectionStatus.data.phoneNumber}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleRefresh}
                disabled={connectionStatus.status === 'DISCONNECTED'}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* QR Code Area */}
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              QR Code WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            {connectionStatus.status === 'CONNECTED' ? (
              <div className="py-8">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-green-700 mb-2">WhatsApp Conectado!</h3>
                <p className="text-muted-foreground">
                  {connectionStatus.data?.phoneNumber || 'Dispositivo conectado com sucesso'}
                </p>
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
              <div className="py-4">
                <div className="bg-white p-4 rounded-lg border inline-block">
                  {qrCode.startsWith('data:image') ? (
                    <img 
                      src={qrCode} 
                      alt="QR Code WhatsApp" 
                      className="max-w-64 max-h-64 mx-auto"
                    />
                  ) : qrCode.startsWith('https://wa.me/qr/TEST_') ? (
                    <div className="w-64 h-64 flex items-center justify-center border-2 border-dashed border-gray-300 rounded">
                      <div className="text-center">
                        <QrCode className="h-16 w-16 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">QR Code de Teste</p>
                        <p className="text-xs text-gray-400 mt-1">Modo Desenvolvimento</p>
                      </div>
                    </div>
                  ) : (
                    <div className="w-64 h-64 flex items-center justify-center border border-gray-300 rounded bg-white">
                      <div className="text-center">
                        <p className="text-sm text-gray-600 mb-2">QR Code Recebido</p>
                        <code className="text-xs bg-gray-100 p-2 rounded break-all">
                          {qrCode.substring(0, 50)}...
                        </code>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-4 space-y-2">
                  <p className="font-medium">Escaneie o QR Code</p>
                  <p className="text-sm text-muted-foreground">
                    WhatsApp → Menu (⋮) → Dispositivos conectados → Conectar dispositivo
                  </p>
                  {qrCode.startsWith('https://wa.me/qr/TEST_') && (
                    <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        ⚠️ Este é um QR Code de teste para desenvolvimento. 
                        Para uso real, configure o WppConnect.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : connectionStatus.status === 'CONNECTING' ? (
              <div className="py-8">
                <Loader2 className="h-16 w-16 text-blue-500 mx-auto mb-4 animate-spin" />
                <h3 className="text-lg font-semibold mb-2">Estabelecendo Conexão</h3>
                <p className="text-muted-foreground">
                  Aguarde enquanto configuramos a conexão...
                </p>
              </div>
            ) : (
              <div className="py-8">
                <QrCode className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">WhatsApp Desconectado</h3>
                <p className="text-muted-foreground mb-4">
                  Clique em "Conectar WhatsApp" para iniciar
                </p>
                <Button 
                  onClick={handleConnect}
                  disabled={connectionStatus.status !== 'DISCONNECTED'}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Power className="h-4 w-4 mr-2" />
                  Conectar WhatsApp
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Terminal Logs */}
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Log de Conexão
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-96 p-4">
              <div className="font-mono text-sm space-y-2 bg-slate-950 text-green-400 p-4 rounded">
                {logs.length === 0 ? (
                  <div className="text-center text-slate-500 py-8">
                    <Terminal className="h-8 w-8 mx-auto mb-2" />
                    <p>Aguardando atividade...</p>
                  </div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="flex items-start gap-2">
                      {getLogIcon(log.logType)}
                      <span className="text-xs text-slate-400">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span 
                        className={
                          log.logType === 'success' ? 'text-green-400' :
                          log.logType === 'error' ? 'text-red-400' :
                          'text-blue-400'
                        }
                      >
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card className="shadow-elegant">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <h4 className="font-medium mb-2">Como conectar seu WhatsApp:</h4>
              <ol className="text-sm text-muted-foreground space-y-1">
                <li>1. Clique em "Conectar WhatsApp"</li>
                <li>2. Aguarde o QR Code ser gerado</li>
                <li>3. Abra o WhatsApp no seu celular</li>
                <li>4. Vá em Menu → Dispositivos conectados → Conectar dispositivo</li>
                <li>5. Escaneie o QR Code exibido na tela</li>
                <li>6. Aguarde a confirmação de conexão</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppConnector;