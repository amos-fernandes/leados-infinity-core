-- Criar tabela para conversações do WhatsApp
CREATE TABLE public.whatsapp_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_name TEXT,
  status TEXT DEFAULT 'ativa',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own conversations" 
ON public.whatsapp_conversations 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations" 
ON public.whatsapp_conversations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations" 
ON public.whatsapp_conversations 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Criar tabela para mensagens das conversações
CREATE TABLE public.conversation_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL CHECK (message_type IN ('USER', 'BOT', 'SYSTEM')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para mensagens
CREATE POLICY "Users can view messages from their conversations" 
ON public.conversation_messages 
FOR SELECT 
USING (
  conversation_id IN (
    SELECT id FROM public.whatsapp_conversations 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create messages in their conversations" 
ON public.conversation_messages 
FOR INSERT 
WITH CHECK (
  conversation_id IN (
    SELECT id FROM public.whatsapp_conversations 
    WHERE user_id = auth.uid()
  )
);

-- Trigger para atualizar updated_at
CREATE TRIGGER conv_update_updated_at
BEFORE UPDATE ON public.whatsapp_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_conversations_user_phone ON public.whatsapp_conversations(user_id, contact_phone);
CREATE INDEX idx_messages_conversation ON public.conversation_messages(conversation_id, created_at DESC);