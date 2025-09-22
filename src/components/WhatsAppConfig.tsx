import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { 
  Settings, 
  MessageCircle, 
  Key, 
  Phone,
  CheckCircle2,
  AlertCircle,
  Save
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WhatsAppConfigData {
  id?: string;
  access_token: string;
  phone_number: string;
  webhook_url: string;
  welcome_message: string;
  is_active: boolean;
}

const WhatsAppConfig = () => {
  const { user } = useAuth();
  const [config, setConfig] = useState<WhatsAppConfigData>({
    access_token: "",
    phone_number: "",
    webhook_url: "",
    welcome_message: "Olá! Obrigado por entrar em contato. Como posso ajudá-lo?",
    is_active: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (user) {
      loadConfig();
    }
  }, [user]);

  const loadConfig = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('user_id', user.id)
        .limit(1);

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error;
      }

      if (data && data.length > 0) {
        const configData = data[0];
        setConfig({
          id: configData.id,
          access_token: configData.access_token || "",
          phone_number: configData.phone_number || "",
          webhook_url: configData.webhook_url || "",
          welcome_message: "Olá! Obrigado por entrar em contato. Como posso ajudá-lo?",
          is_active: configData.is_active || false
        });
        setIsConnected(configData.is_active || false);
      } else {
        // Configurar webhook padrão
        const defaultWebhookUrl = `${window.location.origin}/webhook/whatsapp`;
        setConfig(prev => ({
          ...prev,
          webhook_url: defaultWebhookUrl
        }));
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
      toast.error("Erro ao carregar configuração do WhatsApp");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    if (!config.access_token || !config.phone_number) {
      toast.error("Token da API e Número de Telefone são obrigatórios");
      return;
    }

    try {
      setSaving(true);

      const configData = {
        user_id: user.id,
        access_token: config.access_token,
        phone_number: config.phone_number,
        webhook_url: config.webhook_url,
        welcome_message: config.welcome_message,
        is_active: config.is_active,
        updated_at: new Date().toISOString()
      };

      let error;
      
      if (config.id) {
        // Atualizar configuração existente
        const result = await supabase
          .from('whatsapp_config')
          .update(configData)
          .eq('id', config.id);
        error = result.error;
      } else {
        // Criar nova configuração
        const result = await supabase
          .from('whatsapp_config')
          .insert([configData]);
        error = result.error;
      }

      if (error) throw error;

      toast.success("Configuração salva com sucesso!");
      setIsConnected(config.is_active);
      loadConfig(); // Recarregar para obter o ID se for uma nova configuração
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      toast.error("Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!config.access_token || !config.phone_number) {
      toast.error("Configure o Token da API e Número de Telefone primeiro");
      return;
    }

    try {
      // Teste básico da conexão com a API do WhatsApp
      const testResponse = await fetch(`https://graph.facebook.com/v17.0/${config.phone_number}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
        },
      });

      if (testResponse.ok) {
        toast.success("Conexão testada com sucesso!");
        setIsConnected(true);
      } else {
        toast.error("Falha no teste de conexão. Verifique as configurações.");
        setIsConnected(false);
      }
    } catch (error) {
      console.error('Erro ao testar conexão:', error);
      toast.error("Erro ao testar conexão");
      setIsConnected(false);
    }
  };

  const webhookInstructions = `
Para configurar o webhook no Meta Business:
1. Acesse o Meta Business Manager
2. Vá em WhatsApp > Configuração > Webhook
3. Use a URL: ${config.webhook_url}
4. Token de verificação: whatsapp-webhook-token
5. Campos: messages, message_deliveries
  `;

  if (loading) {
    return (
      <Card className="shadow-soft">
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-muted-foreground">Carregando configuração...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          Configuração WhatsApp Business
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant={isConnected ? "default" : "secondary"} className="flex items-center gap-1">
            {isConnected ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <AlertCircle className="h-3 w-3" />
            )}
            {isConnected ? "Conectado" : "Desconectado"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Token da API */}
        <div className="space-y-2">
          <Label htmlFor="api_token" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Token da API do WhatsApp Business
          </Label>
          <Input
            id="api_token"
            type="password"
            value={config.access_token}
            onChange={(e) => setConfig({...config, access_token: e.target.value})}
            placeholder="Token da API do Meta Business"
          />
          <p className="text-xs text-muted-foreground">
            Obtenha este token no Meta Business Manager &gt; WhatsApp &gt; Configuração da API
          </p>
        </div>

        {/* Número de Telefone */}
        <div className="space-y-2">
          <Label htmlFor="phone_number" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            ID do Número de Telefone
          </Label>
          <Input
            id="phone_number"
            value={config.phone_number}
            onChange={(e) => setConfig({...config, phone_number: e.target.value})}
            placeholder="ID do número no WhatsApp Business"
          />
          <p className="text-xs text-muted-foreground">
            Encontre este ID no Meta Business Manager &gt; WhatsApp &gt; Números de Telefone
          </p>
        </div>

        {/* Webhook URL */}
        <div className="space-y-2">
          <Label htmlFor="webhook_url" className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Webhook URL
          </Label>
          <Input
            id="webhook_url"
            value={config.webhook_url}
            onChange={(e) => setConfig({...config, webhook_url: e.target.value})}
            placeholder="URL do webhook"
            readOnly
          />
          <Textarea
            value={webhookInstructions}
            readOnly
            rows={6}
            className="text-xs bg-muted"
          />
        </div>

        {/* Mensagem de Boas-vindas */}
        <div className="space-y-2">
          <Label htmlFor="welcome_message">Mensagem de Boas-vindas</Label>
          <Textarea
            id="welcome_message"
            value={config.welcome_message}
            onChange={(e) => setConfig({...config, welcome_message: e.target.value})}
            placeholder="Mensagem enviada automaticamente para novos contatos"
            rows={3}
          />
        </div>

        {/* Status Ativo */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label>Bot Ativo</Label>
            <p className="text-xs text-muted-foreground">
              Ativar respostas automáticas via IA
            </p>
          </div>
          <Switch
            checked={config.is_active}
            onCheckedChange={(checked) => setConfig({...config, is_active: checked})}
          />
        </div>

        {/* Botões de Ação */}
        <div className="flex gap-3">
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="flex-1"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Configuração"}
          </Button>
          <Button 
            variant="outline" 
            onClick={handleTestConnection}
            disabled={!config.access_token || !config.phone_number}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Testar Conexão
          </Button>
        </div>

        {/* Status da Configuração */}
        {config.access_token && config.phone_number && (
          <div className="p-4 rounded-lg bg-muted/50">
            <h4 className="font-medium mb-2">Status da Configuração</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Token:</span>
                <p className="font-medium">Configurado</p>
              </div>
              <div>
                <span className="text-muted-foreground">Número:</span>
                <p className="font-medium">Configurado</p>
              </div>
              <div>
                <span className="text-muted-foreground">Webhook:</span>
                <p className="font-medium">Configurado</p>
              </div>
              <div>
                <span className="text-muted-foreground">Bot:</span>
                <p className="font-medium">
                  {config.is_active ? "Ativo" : "Inativo"}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WhatsAppConfig;