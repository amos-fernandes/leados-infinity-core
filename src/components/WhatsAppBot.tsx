import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  MessageCircle, 
  Send, 
  Phone, 
  User,
  Bot,
  Activity,
  Clock,
  CheckCircle,
  Power,
  PowerOff
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";

interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  message: string;
  timestamp: Date;
  type: 'incoming' | 'outgoing';
  status: 'sent' | 'delivered' | 'read';
  leadName?: string;
  phoneNumber?: string;
}

interface WhatsAppActivity {
  id: string;
  type: 'message' | 'call' | 'lead_created' | 'bot_response';
  description: string;
  timestamp: Date;
  status: 'success' | 'pending' | 'error';
}

const WhatsAppBot = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [activities, setActivities] = useState<WhatsAppActivity[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isBotActive, setIsBotActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user && isBotActive) {
      loadInitialData();
      setupRealTimeMonitoring();
    }
  }, [user, isBotActive]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadInitialData = async () => {
    if (!user) return;

    try {
      // Configurar webhook URL
      const projectRef = 'ibaonnnakuuerrgtilze';
      const webhookEndpoint = `https://${projectRef}.functions.supabase.co/functions/v1/whatsapp-webhook`;
      setWebhookUrl(webhookEndpoint);

      // Verificar/criar configuração do WhatsApp
      const { data: existingConfig } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('user_id', user.id)
        .limit(1);

      if (!existingConfig || existingConfig.length === 0) {
        await supabase
          .from('whatsapp_config')
          .insert({
            user_id: user.id,
            webhook_url: webhookEndpoint,
            is_active: false
          });
      }

      // Carregar mensagens existentes
      await loadRealMessages();

      const initialActivity: WhatsAppActivity = {
        id: 'bot-start',
        type: 'bot_response',
        description: 'Sistema WhatsApp da Única Contábil inicializado',
        timestamp: new Date(),
        status: 'success'
      };

      setActivities([initialActivity]);
    } catch (error) {
      console.error('Erro ao carregar dados iniciais:', error);
    }
  };

  const setupRealTimeMonitoring = () => {
    // Monitorar mensagens reais a cada 10 segundos
    const interval = setInterval(() => {
      if (isBotActive) {
        loadRealMessages();
      }
    }, 10000);

    return () => clearInterval(interval);
  };

  const loadRealMessages = async () => {
    if (!user) return;

    try {
      const { data: whatsappMessages } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(50);

      if (whatsappMessages && whatsappMessages.length > 0) {
        const convertedMessages: WhatsAppMessage[] = whatsappMessages.map(msg => ({
          id: msg.id,
          from: msg.phone_number,
          to: '+5562981959829',
          message: msg.message_content,
          timestamp: new Date(msg.created_at),
          type: 'incoming',
          status: 'read',
          leadName: msg.sender_name,
          phoneNumber: msg.phone_number
        }));

        setMessages(convertedMessages);

        // Atualizar atividades baseadas nas mensagens reais
        const newActivities: WhatsAppActivity[] = whatsappMessages.map(msg => ({
          id: `real-${msg.id}`,
          type: msg.response_sent ? 'bot_response' : 'message',
          description: msg.response_sent 
            ? `Bot respondeu para ${msg.sender_name}`
            : `Mensagem recebida de ${msg.sender_name} (${msg.phone_number})`,
          timestamp: new Date(msg.created_at),
          status: 'success'
        }));

        setActivities(prev => {
          const existingIds = prev.map(a => a.id);
          const uniqueActivities = newActivities.filter(a => !existingIds.includes(a.id));
          return [...uniqueActivities, ...prev].slice(0, 20);
        });
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens reais:', error);
    }
  };

  const respondWithAI = async (userMessage: string, clientName: string, phoneNumber: string) => {
    if (!user) return;

    try {
      // Chamar função RAG para gerar resposta inteligente
      const { data, error } = await supabase.functions.invoke('rag-chat', {
        body: { 
          message: `Cliente ${clientName} via WhatsApp perguntou: ${userMessage}`,
          userId: user.id,
          isWhatsAppBot: true
        }
      });

      if (error) throw error;

      let botResponse = data?.response || "Obrigado pela sua mensagem! Em breve um de nossos consultores entrará em contato.";
      
      // Personalizar resposta para WhatsApp
      botResponse = `🤖 *Única Contábil*\n\nOlá ${clientName}!\n\n${botResponse}\n\n📞 Para falar diretamente com um consultor: (62) 9 8195-9829\n📅 Agende uma consultoria: https://calendly.com/unica-contabil`;

      const botMessage: WhatsAppMessage = {
        id: `bot-${Date.now()}`,
        from: '+5562981959829',
        to: phoneNumber,
        message: botResponse,
        timestamp: new Date(),
        type: 'outgoing',
        status: 'sent'
      };

      setMessages(prev => [...prev, botMessage]);

      // Registrar atividade
      const activity: WhatsAppActivity = {
        id: `bot-activity-${Date.now()}`,
        type: 'bot_response',
        description: `Bot respondeu automaticamente para ${clientName}`,
        timestamp: new Date(),
        status: 'success'
      };

      setActivities(prev => [activity, ...prev.slice(0, 19)]);

      // Armazenar resposta na base de conhecimento
      await storeInteractionInKnowledge(botResponse, 'outgoing', clientName);

    } catch (error) {
      console.error('Erro ao gerar resposta com IA:', error);
      
      // Resposta fallback
      const fallbackResponse = `🤖 *Única Contábil*\n\nOlá ${clientName}! Obrigado pelo seu contato.\n\nRecebemos sua mensagem e em breve um de nossos consultores especializados entrará em contato.\n\n📞 Urgente? Ligue: (62) 9 8195-9829\n📧 E-mail: contato@unicacontabil.com`;

      const botMessage: WhatsAppMessage = {
        id: `bot-fallback-${Date.now()}`,
        from: '+5562981959829',
        to: phoneNumber,
        message: fallbackResponse,
        timestamp: new Date(),
        type: 'outgoing',
        status: 'sent'
      };

      setMessages(prev => [...prev, botMessage]);
    }
  };

  const sendManualMessage = async () => {
    if (!newMessage.trim() || !phoneNumber.trim()) {
      toast({
        title: "Erro",
        description: "Preencha o número e a mensagem",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Enviar via WhatsApp API
      const { data, error } = await supabase.functions.invoke('whatsapp-send-message', {
        body: {
          to: phoneNumber,
          message: newMessage,
          userId: user?.id
        }
      });

      if (error) {
        throw error;
      }

      const sentMessage: WhatsAppMessage = {
        id: `manual-${Date.now()}`,
        from: '+5562981959829',
        to: phoneNumber,
        message: newMessage,
        timestamp: new Date(),
        type: 'outgoing',
        status: 'sent'
      };

      setMessages(prev => [...prev, sentMessage]);
      
      // Registrar atividade
      const activity: WhatsAppActivity = {
        id: `manual-activity-${Date.now()}`,
        type: 'message',
        description: `Mensagem enviada via WhatsApp para ${phoneNumber}`,
        timestamp: new Date(),
        status: 'success'
      };

      setActivities(prev => [activity, ...prev.slice(0, 19)]);

      setNewMessage('');
      
      toast({
        title: "Sucesso",
        description: "Mensagem enviada via WhatsApp!",
      });

    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar mensagem via WhatsApp",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const testWebhook = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Simular mensagem recebida para testar o sistema
      const testMessage = {
        user_id: user.id,
        phone_number: '+5562999887766',
        sender_name: 'Teste Cliente',
        message_content: 'Olá! Gostaria de saber mais sobre seus serviços contábeis.',
        message_type: 'text',
        processed: false,
        response_sent: false
      };

      const { error } = await supabase
        .from('whatsapp_messages')
        .insert(testMessage);

      if (error) {
        throw error;
      }

      // Chamar o bot responder
      await supabase.functions.invoke('whatsapp-bot-responder', {
        body: {
          message: testMessage.message_content,
          phoneNumber: testMessage.phone_number,
          clientName: testMessage.sender_name,
          userId: user.id
        }
      });

      toast({
        title: "Teste Executado",
        description: "Mensagem de teste processada com sucesso!",
      });

      // Recarregar mensagens
      await loadRealMessages();

    } catch (error) {
      console.error('Erro no teste:', error);
      toast({
        title: "Erro",
        description: "Erro ao executar teste do webhook",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const storeInteractionInKnowledge = async (content: string, type: string, clientName?: string) => {
    if (!user) return;

    try {
      const knowledgeEntry = {
        user_id: user.id,
        content: `WhatsApp ${type}${clientName ? ` (${clientName})` : ''}: ${content}`,
        generated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('campaign_knowledge')
        .insert(knowledgeEntry);

      if (error) {
        console.error('Erro ao salvar na base de conhecimento:', error);
      }
    } catch (error) {
      console.error('Erro ao salvar na base de conhecimento:', error);
    }
  };

  const toggleBot = async () => {
    if (!user) return;

    const newActiveState = !isBotActive;
    setIsBotActive(newActiveState);
    
    try {
      // Atualizar configuração no banco
      await supabase
        .from('whatsapp_config')
        .update({ is_active: newActiveState })
        .eq('user_id', user.id);

      if (newActiveState) {
        toast({
          title: "Bot Ativado",
          description: "Bot WhatsApp da Única Contábil está agora atendendo automaticamente mensagens reais",
        });
      } else {
        toast({
          title: "Bot Desativado",
          description: "Bot WhatsApp foi desativado",
        });
      }
    } catch (error) {
      console.error('Erro ao atualizar configuração:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar configuração do bot",
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'pending': return <Clock className="h-3 w-3 text-yellow-500" />;
      case 'error': return <Activity className="h-3 w-3 text-red-500" />;
      default: return <Activity className="h-3 w-3 text-gray-500" />;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'message': return <MessageCircle className="h-4 w-4" />;
      case 'call': return <Phone className="h-4 w-4" />;
      case 'lead_created': return <User className="h-4 w-4" />;
      case 'bot_response': return <Bot className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Controle do Bot */}
      <Card className="shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-500" />
            Bot WhatsApp Única Contábil
            <Badge variant={isBotActive ? "default" : "secondary"} className="ml-auto">
              {isBotActive ? "Ativo" : "Inativo"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                {isBotActive ? "Bot está atendendo automaticamente" : "Bot desativado"}
              </p>
              <p className="text-sm text-muted-foreground">
                {isBotActive ? "Respondendo mensagens reais via WhatsApp Business API" : "Clique para ativar o atendimento automático"}
              </p>
            </div>
            <Button 
              onClick={toggleBot}
              variant={isBotActive ? "destructive" : "default"}
              size="lg"
            >
              {isBotActive ? (
                <>
                  <PowerOff className="h-4 w-4 mr-2" />
                  Desativar Bot
                </>
              ) : (
                <>
                  <Power className="h-4 w-4 mr-2" />
                  Ativar Bot
                </>
              )}
            </Button>
          </div>
          
          {isBotActive && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{messages.length}</p>
                <p className="text-sm text-muted-foreground">Mensagens</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{activities.filter(a => a.status === 'success').length}</p>
                <p className="text-sm text-muted-foreground">Interações</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{activities.filter(a => a.type === 'bot_response').length}</p>
                <p className="text-sm text-muted-foreground">Respostas IA</p>
              </div>
            </div>
          )}
          
          {/* Webhook Configuration */}
          {isBotActive && webhookUrl && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Configuração do Webhook</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Configure este URL no seu WhatsApp Business API:
              </p>
              <code className="block p-2 bg-background rounded text-xs break-all">
                {webhookUrl}
              </code>
              <p className="text-xs text-muted-foreground mt-2">
                Token de verificação: UNICA_CONTABIL_WEBHOOK_TOKEN
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {isBotActive && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Interface de Chat */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-green-500" />
                Mensagens WhatsApp Reais
                <Badge variant="outline" className="ml-auto">
                  {messages.length} mensagens
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-96 p-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div key={message.id} className={`flex gap-3 ${message.type === 'outgoing' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex gap-3 max-w-[80%] ${message.type === 'outgoing' ? 'flex-row-reverse' : ''}`}>
                        <div className={`p-2 rounded-full ${message.type === 'outgoing' ? 'bg-green-500' : 'bg-blue-500'}`}>
                          {message.type === 'outgoing' ? (
                            <Bot className="h-4 w-4 text-white" />
                          ) : (
                            <User className="h-4 w-4 text-white" />
                          )}
                        </div>
                        <div className={`p-3 rounded-lg ${
                          message.type === 'outgoing' 
                            ? 'bg-green-500 text-white' 
                            : 'bg-muted'
                        }`}>
                          {message.leadName && (
                            <p className="text-xs font-medium mb-1 opacity-75">{message.leadName}</p>
                          )}
                          <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                          <p className="text-xs opacity-75 mt-1">
                            {formatDistanceToNow(message.timestamp, { addSuffix: true, locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              <Separator />
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Activity className="h-4 w-4" />
                  <span>Mensagens reais do WhatsApp Business API</span>
                </div>
                <Input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Número do WhatsApp (ex: +5562999887766)"
                />
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Enviar mensagem via WhatsApp API..."
                    onKeyPress={(e) => e.key === 'Enter' && sendManualMessage()}
                  />
                  <Button onClick={sendManualMessage} disabled={loading}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={testWebhook}
                    disabled={loading}
                  >
                    Testar Webhook
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => loadRealMessages()}
                    disabled={loading}
                  >
                    Atualizar Mensagens
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  * Requer configuração do WhatsApp Business API
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Atividades em Tempo Real */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-accent" />
                Log de Atividades IA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="p-2 rounded-full bg-accent/10">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{activity.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(activity.timestamp, { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                      {getStatusIcon(activity.status)}
                    </div>
                  ))}
                  {activities.length === 0 && (
                    <div className="text-center py-8">
                      <Bot className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                      <p className="text-muted-foreground">Bot aguardando mensagens</p>
                      <p className="text-sm text-muted-foreground">As interações aparecerão aqui em tempo real</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default WhatsAppBot;