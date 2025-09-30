import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  MessageSquare, 
  Bot,
  User,
  Send,
  Phone,
  RefreshCw,
  Clock,
  CheckCircle
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Conversation {
  id: string;
  contact_phone: string;
  contact_name: string;
  status: string;
  created_at: string;
  updated_at: string;
  conversation_messages: ConversationMessage[];
}

interface ConversationMessage {
  id: string;
  message_type: string;
  content: string;
  created_at: string;
  metadata: any;
}

const WhatsAppConversations = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("");

  useEffect(() => {
    if (user) {
      loadConversations();
      
      // Auto-refresh a cada 30 segundos
      const interval = setInterval(loadConversations, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const loadConversations = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select(`
          *,
          conversation_messages (
            id,
            message_type,
            content,
            created_at,
            metadata
          )
        `)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setConversations(data || []);
      
      // Se há uma conversação selecionada, atualizá-la
      if (selectedConversation) {
        const updatedSelected = data?.find(c => c.id === selectedConversation.id);
        if (updatedSelected) {
          setSelectedConversation(updatedSelected);
        }
      }

    } catch (error) {
      console.error('Erro ao carregar conversações:', error);
      toast.error("Erro ao carregar conversações");
    } finally {
      setLoading(false);
    }
  };

  const processPendingMessages = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-rag-responder', {
        body: { 
          action: 'processPending',
          userId: user?.id 
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.message);
        await loadConversations();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Erro ao processar mensagens:', error);
      toast.error("Erro ao processar mensagens pendentes");
    } finally {
      setProcessing(false);
    }
  };

  const testRAGResponse = async () => {
    if (!testPhone || !testMessage) {
      toast.error("Preencha telefone e mensagem para teste");
      return;
    }

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-rag-responder', {
        body: { 
          action: 'quickResponse',
          userId: user?.id,
          phone: testPhone,
          message: testMessage
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Resposta RAG enviada: ${data.responseText.substring(0, 80)}...`);
        setTestPhone("");
        setTestMessage("");
        await loadConversations();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Erro no teste RAG:', error);
      toast.error("Erro ao testar resposta RAG");
    } finally {
      setProcessing(false);
    }
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'USER':
        return <User className="h-4 w-4 text-blue-500" />;
      case 'BOT':
        return <Bot className="h-4 w-4 text-green-500" />;
      default:
        return <MessageSquare className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-6rem)]">
      {/* Lista de Conversações */}
      <div className="lg:col-span-1">
        <Card className="h-full">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Conversações WhatsApp
              </CardTitle>
              <Button
                size="sm"
                onClick={processPendingMessages}
                disabled={processing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${processing ? 'animate-spin' : ''}`} />
                {processing ? 'Processando...' : 'Processar Pendentes'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-12rem)]">
              {loading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Carregando conversações...
                </div>
              ) : conversations.length > 0 ? (
                <div className="space-y-2 p-4">
                  {conversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedConversation?.id === conversation.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedConversation(conversation)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">
                            {conversation.contact_name}
                          </span>
                        </div>
                        <Badge variant={conversation.status === 'ativa' ? 'default' : 'secondary'}>
                          {conversation.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">
                        {conversation.contact_phone}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {conversation.conversation_messages?.length || 0} mensagens
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatMessageTime(conversation.updated_at)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma conversação encontrada</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Chat da Conversação Selecionada */}
      <div className="lg:col-span-2">
        <Card className="h-full flex flex-col">
          <CardHeader className="pb-4">
            <CardTitle>
              {selectedConversation ? (
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Chat com {selectedConversation.contact_name}
                  <Badge variant="outline">{selectedConversation.contact_phone}</Badge>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  Atendimento RAG - C6 Bank
                </div>
              )}
            </CardTitle>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col">
            {selectedConversation ? (
              // Chat da conversação
              <>
                <ScrollArea className="flex-1 mb-4">
                  <div className="space-y-3">
                    {selectedConversation.conversation_messages?.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex gap-3 ${
                          msg.message_type === 'BOT' ? 'justify-start' : 'justify-end'
                        }`}
                      >
                        <div className={`flex gap-2 max-w-[80%] ${
                          msg.message_type === 'BOT' ? 'flex-row' : 'flex-row-reverse'
                        }`}>
                          <div className="mt-1">
                            {getMessageIcon(msg.message_type)}
                          </div>
                          <div className={`rounded-lg p-3 ${
                            msg.message_type === 'BOT'
                              ? 'bg-muted'
                              : 'bg-primary text-primary-foreground'
                          }`}>
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            <p className={`text-xs mt-1 ${
                              msg.message_type === 'BOT' 
                                ? 'text-muted-foreground' 
                                : 'text-primary-foreground/70'
                            }`}>
                              {formatMessageTime(msg.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <Separator className="mb-4" />

                {/* Input para enviar mensagem manual */}
                <div className="flex gap-2">
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Digite uma mensagem manual..."
                    className="flex-1 min-h-[60px] resize-none"
                    rows={2}
                  />
                  <Button
                    onClick={() => {
                      // Implementar envio manual posteriormente
                      toast.info("Funcionalidade de envio manual será implementada");
                    }}
                    disabled={!newMessage.trim() || processing}
                    className="self-end"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              // Interface de teste RAG
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-full max-w-md space-y-4">
                  <div className="text-center mb-6">
                    <Bot className="h-12 w-12 text-primary mx-auto mb-4" />
                    <h3 className="text-lg font-semibold">Teste do Chatbot RAG</h3>
                    <p className="text-sm text-muted-foreground">
                      Simule uma conversa com o assistente C6 Bank
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Input
                      placeholder="Número do WhatsApp (ex: 5562999999999)"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                    />
                    <Textarea
                      placeholder="Mensagem para testar o RAG..."
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      rows={3}
                    />
                    <Button
                      onClick={testRAGResponse}
                      disabled={!testPhone || !testMessage || processing}
                      className="w-full"
                    >
                      {processing ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <Bot className="h-4 w-4 mr-2" />
                          Testar Resposta RAG
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4 text-sm">
                    <h4 className="font-medium mb-2">📋 Como funciona:</h4>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      <li>• Cliente envia mensagem WhatsApp</li>
                      <li>• Sistema processa via RAG AI</li>
                      <li>• Resposta automática é enviada</li>
                      <li>• Conversação é salva no CRM</li>
                      <li>• Monitoramento em tempo real</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WhatsAppConversations;