-- Criar tabela para mensagens agendadas
CREATE TABLE IF NOT EXISTS public.scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'executing', 'sent', 'failed', 'retrying')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  phone_number TEXT NOT NULL,
  message_content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_scheduled_messages_user_id ON public.scheduled_messages(user_id);
CREATE INDEX idx_scheduled_messages_campaign_id ON public.scheduled_messages(campaign_id);
CREATE INDEX idx_scheduled_messages_scheduled_time ON public.scheduled_messages(scheduled_time);
CREATE INDEX idx_scheduled_messages_status ON public.scheduled_messages(status);
CREATE INDEX idx_scheduled_messages_status_time ON public.scheduled_messages(status, scheduled_time);

-- RLS Policies
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scheduled messages"
  ON public.scheduled_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own scheduled messages"
  ON public.scheduled_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduled messages"
  ON public.scheduled_messages FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage all scheduled messages"
  ON public.scheduled_messages FOR ALL
  USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_scheduled_messages_updated_at
  BEFORE UPDATE ON public.scheduled_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela para logging de execuções do scheduler
CREATE TABLE IF NOT EXISTS public.scheduler_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  campaign_id UUID,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_scheduler_logs_user_id ON public.scheduler_logs(user_id);
CREATE INDEX idx_scheduler_logs_campaign_id ON public.scheduler_logs(campaign_id);
CREATE INDEX idx_scheduler_logs_created_at ON public.scheduler_logs(created_at);

ALTER TABLE public.scheduler_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scheduler logs"
  ON public.scheduler_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage all scheduler logs"
  ON public.scheduler_logs FOR ALL
  USING (true);