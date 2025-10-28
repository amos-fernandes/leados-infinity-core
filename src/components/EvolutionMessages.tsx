import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Send, Phone, CheckCheck, Check } from 'lucide-react';
import { format } from 'date-fns';

interface EvolutionMessagesProps {
  instanceId: string;
}

interface Message {
  id: string;
  remote_jid: string;
  from_me: boolean;
  message_type: string;
  message_content: string;
  media_url: string | null;
  status: string;
  timestamp: string;
}

const EvolutionMessages = ({ instanceId }: EvolutionMessagesProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedNumber, setSelectedNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadMessages();

    // Realtime updates
    const channel = supabase
      .channel('evolution_messages_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'evolution_messages',
          filter: `instance_id=eq.${instanceId}`
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [instanceId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('evolution_messages')
        .select('*')
        .eq('instance_id', instanceId)
        .order('timestamp', { ascending: true })
        .limit(100);

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedNumber.trim()) {
      toast({
        title: 'Atenção',
        description: 'Digite uma mensagem e um número',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.functions.invoke('evolution-send-message', {
        body: {
          instanceId,
          number: selectedNumber,
          text: newMessage
        }
      });

      if (error) throw error;

      setNewMessage('');
      
      toast({
        title: 'Sucesso',
        description: 'Mensagem enviada'
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao enviar mensagem',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getMessageIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <Check className="w-3 h-3" />;
      case 'delivered':
      case 'read':
        return <CheckCheck className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const formatPhoneNumber = (jid: string) => {
    const number = jid.split('@')[0];
    return number.replace('55', '+55 ');
  };

  const uniqueContacts = Array.from(
    new Set(messages.map(m => m.remote_jid))
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Lista de Contatos */}
      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle className="text-lg">Conversas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-1">
            {uniqueContacts.map((contact) => (
              <button
                key={contact}
                onClick={() => setSelectedNumber(contact.split('@')[0])}
                className={`w-full text-left px-4 py-3 hover:bg-accent transition-colors ${
                  selectedNumber === contact.split('@')[0] ? 'bg-accent' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  <span className="text-sm">{formatPhoneNumber(contact)}</span>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Área de Mensagens */}
      <Card className="md:col-span-2">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">
              {selectedNumber ? formatPhoneNumber(selectedNumber + '@s.whatsapp.net') : 'Mensagens'}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Mensagens */}
            <div className="h-96 overflow-y-auto space-y-3 p-4 bg-accent/20 rounded-lg">
              {messages
                .filter(m => !selectedNumber || m.remote_jid.includes(selectedNumber))
                .map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.from_me ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg px-4 py-2 ${
                        message.from_me
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card'
                      }`}
                    >
                      {message.message_type === 'call' ? (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-4 h-4" />
                          <span>Chamada recebida</span>
                        </div>
                      ) : (
                        <>
                          {message.media_url && (
                            <div className="mb-2">
                              {message.message_type === 'image' && (
                                <img
                                  src={message.media_url}
                                  alt="Imagem"
                                  className="rounded max-w-full"
                                />
                              )}
                              {message.message_type === 'video' && (
                                <video
                                  src={message.media_url}
                                  controls
                                  className="rounded max-w-full"
                                />
                              )}
                              {message.message_type === 'audio' && (
                                <audio src={message.media_url} controls />
                              )}
                            </div>
                          )}
                          <p className="text-sm break-words">{message.message_content}</p>
                        </>
                      )}
                      <div className="flex items-center gap-1 justify-end mt-1">
                        <span className="text-xs opacity-70">
                          {format(new Date(message.timestamp), 'HH:mm')}
                        </span>
                        {message.from_me && getMessageIcon(message.status)}
                      </div>
                    </div>
                  </div>
                ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input de Mensagem */}
            <div className="space-y-2">
              <Input
                placeholder="Número do destinatário (com DDD)"
                value={selectedNumber}
                onChange={(e) => setSelectedNumber(e.target.value)}
              />
              <div className="flex gap-2">
                <Input
                  placeholder="Digite sua mensagem..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <Button onClick={handleSendMessage} disabled={loading}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EvolutionMessages;
