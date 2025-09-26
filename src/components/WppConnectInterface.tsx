import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  MessageCircle, 
  Send, 
  QrCode,
  Smartphone,
  Bot,
  Activity,
  CheckCircle,
  AlertCircle,
  Wifi,
  WifiOff
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";

interface WppConnectSession {
  sessionName: string;
  status: 'disconnected' | 'connecting' | 'qr' | 'connected';
  qrCode?: string;
  phoneNumber?: string;
}

const WppConnectInterface = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [session, setSession] = useState<WppConnectSession>({
    sessionName: '',
    status: 'disconnected'
  });
  const [newMessage, setNewMessage] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionName, setSessionName] = useState('');

  useEffect(() => {
    if (user) {
      setSessionName(`session_${user.id.slice(0, 8)}`);
    }
  }, [user]);

  const initializeWppConnect = async () => {
    if (!sessionName || !user) {
      toast({
        title: "Erro",
        description: "Nome da sessão é obrigatório",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setSession(prev => ({ ...prev, status: 'connecting' }));

    try {
      const { data, error } = await supabase.functions.invoke('wppconnect-init', {
        body: {
          sessionName,
          userId: user.id
        }
      });

      if (error) throw error;

      if (data.success) {
        setSession({
          sessionName,
          status: data.qrCode ? 'qr' : 'connected',
          qrCode: data.qrCode,
          phoneNumber: data.phoneNumber
        });

        toast({
          title: "Sucesso",
          description: data.message,
        });

        if (data.qrCode) {
          toast({
            title: "QR Code Gerado",
            description: "Escaneie o QR Code com seu WhatsApp para conectar",
          });
        }
      }
    } catch (error) {
      console.error('Erro ao inicializar WppConnect:', error);
      setSession(prev => ({ ...prev, status: 'disconnected' }));
      toast({
        title: "Erro",
        description: "Erro ao inicializar sessão WppConnect",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const sendWppConnectMessage = async () => {
    if (!newMessage.trim() || !phoneNumber.trim() || !sessionName) {
      toast({
        title: "Erro",
        description: "Preencha o número e a mensagem",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('wppconnect-send-message', {
        body: {
          sessionName,
          to: phoneNumber,
          message: newMessage,
          userId: user?.id
        }
      });

      if (error) throw error;

      if (data.success) {
        setNewMessage('');
        toast({
          title: "Sucesso",
          description: data.message,
        });
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar mensagem",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = () => {
    switch (session.status) {
      case 'connected': return <Wifi className="h-4 w-4 text-green-500" />;
      case 'connecting': return <Activity className="h-4 w-4 text-yellow-500 animate-spin" />;
      case 'qr': return <QrCode className="h-4 w-4 text-blue-500" />;
      default: return <WifiOff className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusText = () => {
    switch (session.status) {
      case 'connected': return 'Conectado';
      case 'connecting': return 'Conectando...';
      case 'qr': return 'Aguardando QR Code';
      default: return 'Desconectado';
    }
  };

  const getStatusVariant = () => {
    switch (session.status) {
      case 'connected': return 'default';
      case 'connecting': return 'secondary';
      case 'qr': return 'secondary';
      default: return 'destructive';
    }
  };

  return (
    <div className="space-y-6">
      {/* Status da Sessão WppConnect */}
      <Card className="shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-500" />
            WppConnect - Status da Sessão
            <Badge variant={getStatusVariant()} className="ml-auto flex items-center gap-1">
              {getStatusIcon()}
              {getStatusText()}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-3">
              <Input
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="Nome da sessão (ex: minha_empresa)"
                disabled={session.status !== 'disconnected'}
              />
              <Button 
                onClick={initializeWppConnect}
                disabled={loading || session.status === 'connected'}
              >
                {loading ? (
                  <Activity className="h-4 w-4 animate-spin" />
                ) : (
                  <Smartphone className="h-4 w-4" />
                )}
                {session.status === 'disconnected' ? 'Conectar' : 'Reconectar'}
              </Button>
            </div>

            {session.status === 'qr' && session.qrCode && (
              <div className="text-center p-4 border rounded-lg bg-muted/50">
                <QrCode className="h-16 w-16 mx-auto mb-4 text-blue-500" />
                <p className="font-medium mb-2">Escaneie o QR Code com seu WhatsApp</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Abra o WhatsApp no seu celular → Menu → Dispositivos conectados → Conectar um dispositivo
                </p>
                <div className="bg-white p-4 rounded-lg inline-block">
                  <img src={session.qrCode} alt="QR Code" className="max-w-64 max-h-64" />
                </div>
              </div>
            )}

            {session.status === 'connected' && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-green-700">
                  WhatsApp conectado com sucesso!
                </span>
                {session.phoneNumber && (
                  <span className="text-sm text-green-600">({session.phoneNumber})</span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Interface de Envio de Mensagens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-500" />
              Enviar Mensagem WppConnect
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Número do WhatsApp (ex: 5562999887766)"
            />
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Digite sua mensagem..."
              rows={4}
            />
            <Button 
              onClick={sendWppConnectMessage} 
              disabled={loading || session.status !== 'connected'}
              className="w-full"
            >
              <Send className="h-4 w-4 mr-2" />
              Enviar via WppConnect
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-purple-500" />
              Recursos WppConnect
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-full bg-green-100">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium">Múltiplas Sessões</p>
                  <p className="text-sm text-muted-foreground">Conecte várias contas simultaneamente</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-full bg-blue-100">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium">Persistência de Sessão</p>
                  <p className="text-sm text-muted-foreground">Mantém conexão após reinicialização</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-full bg-purple-100">
                  <CheckCircle className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium">Webhooks Automáticos</p>
                  <p className="text-sm text-muted-foreground">Recebe mensagens em tempo real</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-full bg-orange-100">
                  <CheckCircle className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                  <p className="font-medium">Envio de Mídia</p>
                  <p className="text-sm text-muted-foreground">Suporte a imagens, documentos e áudio</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Informações e Configuração */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            Configuração WppConnect Server
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
              <h4 className="font-medium text-yellow-800 mb-2">Requisitos do Sistema</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• WppConnect Server executando (padrão: localhost:21234)</li>
                <li>• Token de autenticação configurado</li>
                <li>• Webhook URL configurada para receber mensagens</li>
                <li>• Chrome/Chromium instalado no servidor</li>
              </ul>
            </div>

            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
              <h4 className="font-medium text-blue-800 mb-2">Configuração Docker</h4>
              <pre className="text-xs text-blue-700 bg-blue-100 p-2 rounded overflow-x-auto">
{`docker run -d \\
  --name wppconnect \\
  -p 21234:21234 \\
  -e AUTHENTICATION_TOKEN=your_token \\
  -e HEADLESS=true \\
  -v ./sessions:/app/sessions \\
  wppconnect/wppconnect-server`}
              </pre>
            </div>

            <div className="p-4 rounded-lg bg-green-50 border border-green-200">
              <h4 className="font-medium text-green-800 mb-2">Status da Configuração</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Servidor WppConnect:</span>
                  <p className="font-medium">Automático</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Token:</span>
                  <p className="font-medium">Configurado</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Webhook:</span>
                  <p className="font-medium">Automático</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Sessão:</span>
                  <p className="font-medium">{session.sessionName || 'Não iniciada'}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WppConnectInterface;