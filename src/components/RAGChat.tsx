import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Bot, 
  Send, 
  MessageCircle, 
  User,
  Loader2,
  Sparkles,
  RefreshCw
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const RAGChat = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Mensagem de boas-vindas
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: '👋 Olá! Sou o assistente IA da LEADOS. Como posso ajudá-lo hoje?\n\nPosso ajudar com:\n• Estratégias de prospecção\n• Qualificação de leads\n• Análise de campanhas\n• Dúvidas sobre vendas\n• Otimização de processos',
        timestamp: new Date()
      }]);
    }
  }, []);

  useEffect(() => {
    // Auto-scroll para o final das mensagens
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages, isTyping]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !user) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);
    setIsTyping(true);

    try {
      // Chama a função RAG do Supabase
      const { data, error } = await supabase.functions.invoke('rag-chat', {
        body: {
          message: userMessage.content,
          userId: user.id,
          chatHistory: messages.slice(-5) // Envia as últimas 5 mensagens como contexto
        }
      });

      if (error) {
        console.error('Erro na função RAG:', error);
        throw new Error(error.message || 'Erro ao processar mensagem');
      }

      let assistantResponse = "Desculpe, não consegui processar sua mensagem. Tente novamente.";
      
      if (data && data.response) {
        assistantResponse = data.response;
      }

      // Simula digitação antes de mostrar a resposta
      setTimeout(() => {
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: assistantResponse,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, assistantMessage]);
        setIsTyping(false);
        setIsLoading(false);
      }, 1500);

    } catch (error) {
      console.error('Erro no chat RAG:', error);
      
      setTimeout(() => {
        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '😔 Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente ou reformule sua pergunta.',
          timestamp: new Date()
        };

        setMessages(prev => [...prev, errorMessage]);
        setIsTyping(false);
        setIsLoading(false);
        toast.error("Erro ao processar mensagem");
      }, 1000);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([{
      id: 'welcome-new',
      role: 'assistant',
      content: '👋 Chat reiniciado! Como posso ajudá-lo agora?',
      timestamp: new Date()
    }]);
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card className="shadow-soft h-[500px] flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bot className="h-5 w-5 text-accent" />
            RAG Assistant IA
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Online
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0">
        {/* Área de mensagens */}
        <ScrollArea className="flex-1 px-4" ref={scrollAreaRef}>
          <div className="space-y-4 pb-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  </div>
                )}
                
                <div className={`max-w-[80%] ${message.role === 'user' ? 'order-2' : ''}`}>
                  <div
                    className={`rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground ml-auto'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 px-1">
                    {formatTimestamp(message.timestamp)}
                  </p>
                </div>

                {message.role === 'user' && (
                  <div className="flex-shrink-0 order-3">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                      <User className="h-4 w-4 text-secondary-foreground" />
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Indicador de digitação */}
            {isTyping && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <div className="flex items-center gap-1">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                    </div>
                    <span className="text-xs text-muted-foreground ml-2">Digitando...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input de mensagem */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite sua pergunta sobre vendas, prospecção, leads..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={isLoading || !inputMessage.trim()}
              size="sm"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            Powered by IA avançada - Respostas baseadas em conhecimento especializado
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default RAGChat;