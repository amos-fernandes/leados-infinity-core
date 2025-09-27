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
  MessageCircle,
  Mail,
  Phone
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";

const WhatsAppConfigComplete = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Configurações fixas
  const phoneNumber = '5562991792303';
  const emailConfig = 'contato@isf.net.br';

  const initializeWppConnect = async () => {
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

  const qualifyLeadsWithWhatsApp = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Buscar leads existentes para qualificar com WhatsApp
      const { data: leads } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', user.id)
        .is('whatsapp_business', null)
        .limit(5);

      if (!leads || leads.length === 0) {
        toast({
          title: "Nenhum Lead",
          description: "Nenhum lead encontrado para qualificar com WhatsApp",
        });
        return;
      }

      let qualifiedCount = 0;
      
      for (const lead of leads) {
        try {
          // Buscar WhatsApp via Google Maps para cada lead
          const { data: mapsData } = await supabase.functions.invoke('google-maps-scraper', {
            body: {
              searchQuery: `${lead.empresa} WhatsApp contato telefone`,
              location: 'Brasil',
              userId: user.id
            }
          });

          if (mapsData?.leads && mapsData.leads.length > 0) {
            const businessData = mapsData.leads[0];
            
            if (businessData.whatsapp) {
              await supabase
                .from('leads')
                .update({
                  whatsapp_business: businessData.whatsapp,
                  telefone: businessData.telefone || lead.telefone,
                  updated_at: new Date().toISOString()
                })
                .eq('id', lead.id);
              
              qualifiedCount++;
              console.log(`WhatsApp encontrado para ${lead.empresa}: ${businessData.whatsapp}`);
            }
          }
        } catch (error) {
          console.error(`Erro ao qualificar ${lead.empresa}:`, error);
        }
      }

      toast({
        title: "Qualificação Concluída",
        description: `${qualifiedCount} leads qualificados com WhatsApp Business`,
      });

    } catch (error) {
      console.error('Erro na qualificação:', error);
      toast({
        title: "Erro",
        description: "Erro na qualificação de leads",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Configuração Completa WhatsApp</h1>
        <p className="text-muted-foreground">
          Configure seu número para disparos e qualifique leads com WhatsApp Business
        </p>
      </div>

      {/* Configurações */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* WhatsApp QR Setup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-green-500" />
              Ativar WhatsApp Disparos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Número Configurado</label>
              <Input value={phoneNumber} disabled className="bg-muted" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Email Configurado</label>
              <Input value={emailConfig} disabled className="bg-muted" />
            </div>

            {/* Status */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span className="text-sm">Status da Conexão</span>
              <Badge variant={isConnected ? "default" : "secondary"}>
                {isConnected ? (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Conectado
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Desconectado
                  </>
                )}
              </Badge>
            </div>

            {/* QR Code */}
            {qrCode && !isConnected && (
              <div className="text-center space-y-3">
                <div className="bg-white p-3 rounded-lg border">
                  <img src={qrCode} alt="QR Code WhatsApp" className="mx-auto max-w-48" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Escaneie com WhatsApp → Menu → Dispositivos conectados
                </p>
              </div>
            )}

            {/* Sucesso */}
            {isConnected && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <div>
                  <p className="font-medium text-green-700">WhatsApp Ativo!</p>
                  <p className="text-sm text-green-600">Disparos configurados</p>
                </div>
              </div>
            )}

            <Button 
              onClick={initializeWppConnect}
              disabled={loading || isConnected}
              className="w-full"
            >
              {loading ? (
                "Conectando..."
              ) : isConnected ? (
                "WhatsApp Ativo"
              ) : (
                <>
                  <Smartphone className="h-4 w-4 mr-2" />
                  Ativar WhatsApp
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Qualificação de Leads */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-blue-500" />
              Qualificar Leads com WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
              <h4 className="font-medium text-blue-800 mb-2">Recursos:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Busca WhatsApp Business via Google Maps</li>
                <li>• Validação de telefones em sites oficiais</li>
                <li>• Dados reais (não inventados)</li>
                <li>• Atualização automática na base</li>
              </ul>
            </div>

            <Button 
              onClick={qualifyLeadsWithWhatsApp}
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              {loading ? (
                "Qualificando..."
              ) : (
                <>
                  <Settings className="h-4 w-4 mr-2" />
                  Qualificar Leads Existentes
                </>
              )}
            </Button>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Campanha Configurada:</span>
                <span className="font-medium">Apenas Disparos</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Leads Fictícios:</span>
                <span className="font-medium text-red-600">Desabilitado</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Fonte de Leads:</span>
                <span className="font-medium">Google Maps + Manual</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Informações das Campanhas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-purple-500" />
            Configuração de Campanhas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <div className="p-2 rounded-full bg-green-100">
                <MessageCircle className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="font-medium">WhatsApp Disparos</p>
                <p className="text-sm text-muted-foreground">Via {phoneNumber}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <div className="p-2 rounded-full bg-blue-100">
                <Mail className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">Email Disparos</p>
                <p className="text-sm text-muted-foreground">Via {emailConfig}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <div className="p-2 rounded-full bg-purple-100">
                <Phone className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="font-medium">CRM Integrado</p>
                <p className="text-sm text-muted-foreground">Oportunidades + Interações</p>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 rounded-lg bg-yellow-50 border border-yellow-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800">Configuração Atual:</p>
                <ul className="text-sm text-yellow-700 mt-2 space-y-1">
                  <li>• Campanhas NÃO geram leads fictícios</li>
                  <li>• Apenas disparos para leads existentes</li>
                  <li>• Criação automática de oportunidades e interações</li>
                  <li>• Agendamentos inseridos no CRM</li>
                  <li>• Resultados mostram dados de email e WhatsApp</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppConfigComplete;