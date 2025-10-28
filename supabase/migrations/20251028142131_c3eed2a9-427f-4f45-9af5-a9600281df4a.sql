-- Tabela para armazenar instâncias da Evolution API
CREATE TABLE IF NOT EXISTS public.evolution_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instance_name TEXT NOT NULL,
  instance_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  phone_number TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected',
  qr_code TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, instance_name)
);

-- Tabela para mensagens WhatsApp via Evolution
CREATE TABLE IF NOT EXISTS public.evolution_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.evolution_instances(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message_id TEXT,
  remote_jid TEXT NOT NULL,
  from_me BOOLEAN NOT NULL DEFAULT false,
  message_type TEXT NOT NULL,
  message_content TEXT,
  media_url TEXT,
  status TEXT DEFAULT 'pending',
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  webhook_data JSONB,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para logs de webhook
CREATE TABLE IF NOT EXISTS public.evolution_webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID REFERENCES public.evolution_instances(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_evolution_instances_user_id ON public.evolution_instances(user_id);
CREATE INDEX IF NOT EXISTS idx_evolution_instances_status ON public.evolution_instances(status);
CREATE INDEX IF NOT EXISTS idx_evolution_messages_instance_id ON public.evolution_messages(instance_id);
CREATE INDEX IF NOT EXISTS idx_evolution_messages_remote_jid ON public.evolution_messages(remote_jid);
CREATE INDEX IF NOT EXISTS idx_evolution_messages_timestamp ON public.evolution_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_evolution_webhook_logs_processed ON public.evolution_webhook_logs(processed);

-- Enable Row Level Security
ALTER TABLE public.evolution_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evolution_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evolution_webhook_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies para evolution_instances
CREATE POLICY "Users can view their own instances"
ON public.evolution_instances FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own instances"
ON public.evolution_instances FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own instances"
ON public.evolution_instances FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own instances"
ON public.evolution_instances FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies para evolution_messages
CREATE POLICY "Users can view their own messages"
ON public.evolution_messages FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own messages"
ON public.evolution_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own messages"
ON public.evolution_messages FOR UPDATE
USING (auth.uid() = user_id);

-- RLS Policies para evolution_webhook_logs (mais permissivo para webhooks)
CREATE POLICY "Users can view webhook logs for their instances"
ON public.evolution_webhook_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.evolution_instances
    WHERE evolution_instances.id = evolution_webhook_logs.instance_id
    AND evolution_instances.user_id = auth.uid()
  )
);

CREATE POLICY "Service role can insert webhook logs"
ON public.evolution_webhook_logs FOR INSERT
WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_evolution_instances_updated_at
BEFORE UPDATE ON public.evolution_instances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.evolution_instances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.evolution_messages;