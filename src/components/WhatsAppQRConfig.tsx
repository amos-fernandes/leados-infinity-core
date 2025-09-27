import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  QrCode,
  Smartphone,
  CheckCircle,
  AlertCircle,
  Settings,
  MessageCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";

const WhatsAppQRConfig = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [phoneNumber] = useState('5562991792303');
  const [emailConfig] = useState('contato@isf.net.br');

  const initializeWhatsApp = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('wppconnect-init', {
        body: {
          sessionName: `session_${user.id.slice(0, 8)}`,
          userId: user.id
        }
      });

      if (error) throw error;

      if (data.success) {
        if (data.qrCode) {
          setQrCode(data.qrCode);
          toast({
            title: "QR Code Gerado",
            description: "Escaneie com seu WhatsApp para ativar os disparos",
          });
        } else {
          setIsConnected(true);
          toast({
            title: "WhatsApp Conectado",
            description: "Disparos ativados com sucesso!",
          });
        }
      }
    } catch (error) {
      console.error('Erro ao inicializar WhatsApp:', error);
      toast({
        title: "Erro",
        description: "Erro ao conectar WhatsApp",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-500" />
            Configuração WhatsApp Disparos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Configurações */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Número de Disparo</label>
              <Input 
                value={phoneNumber} 
                disabled 
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email de Disparo</label>
              <Input 
                value={emailConfig} 
                disabled 
                className="bg-muted"
              />
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span>Status da Conexão</span>
            </div>
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isConnected ? "Conectado" : "Desconectado"}
            </Badge>
          </div>

          {/* QR Code */}
          {qrCode && !isConnected && (
            <div className="text-center space-y-4">
              <div className="bg-white p-4 rounded-lg border">
                <img src={qrCode} alt="QR Code WhatsApp" className="mx-auto max-w-64" />
              </div>
              <div className="space-y-2">
                <p className="font-medium">Escaneie o QR Code com seu WhatsApp</p>
                <p className="text-sm text-muted-foreground">
                  WhatsApp → Menu → Dispositivos conectados → Conectar dispositivo
                </p>
              </div>
            </div>
          )}

          {/* Sucesso */}
          {isConnected && (
            <div className="flex items-center gap-2 p-4 rounded-lg bg-green-50 border border-green-200">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="font-medium text-green-700">WhatsApp Ativado!</p>
                <p className="text-sm text-green-600">
                  Disparos configurados para {phoneNumber}
                </p>
              </div>
            </div>
          )}

          {/* Botão */}
          <Button 
            onClick={initializeWhatsApp}
            disabled={loading || isConnected}
            className="w-full"
            size="lg"
          >
            {loading ? (
              "Conectando..."
            ) : isConnected ? (
              "WhatsApp Ativo"
            ) : (
              <>
                <QrCode className="h-4 w-4 mr-2" />
                Ativar WhatsApp Disparos
              </>
            )}
          </Button>

          {/* Informações */}
          <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-blue-800">Como usar:</p>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Clique em "Ativar WhatsApp Disparos"</li>
                  <li>• Escaneie o QR Code com seu celular</li>
                  <li>• Aguarde confirmação de conexão</li>
                  <li>• Pronto! Disparos ativados</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppQRConfig;