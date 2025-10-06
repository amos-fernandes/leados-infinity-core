-- Criar tabela para logs de erros de campanhas
CREATE TABLE IF NOT EXISTS public.campaign_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_campaign_errors_campaign_id ON public.campaign_errors(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_errors_lead_id ON public.campaign_errors(lead_id);
CREATE INDEX IF NOT EXISTS idx_campaign_errors_error_type ON public.campaign_errors(error_type);
CREATE INDEX IF NOT EXISTS idx_campaign_errors_created_at ON public.campaign_errors(created_at DESC);

-- RLS Policies
ALTER TABLE public.campaign_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their campaign errors"
  ON public.campaign_errors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = campaign_errors.campaign_id
      AND campaigns.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert campaign errors"
  ON public.campaign_errors
  FOR INSERT
  WITH CHECK (true);

-- Adicionar comentários
COMMENT ON TABLE public.campaign_errors IS 'Registra todos os erros ocorridos durante o envio de campanhas (e-mail e WhatsApp)';
COMMENT ON COLUMN public.campaign_errors.error_type IS 'Tipo de erro: NO_MATCH, NO_EMAIL, NO_PHONE, INVALID_WHATSAPP, NO_SCRIPTS, NO_LEADS, INCOMPLETE_SCRIPT, PROCESSING_ERROR';
COMMENT ON COLUMN public.campaign_errors.metadata IS 'Informações adicionais sobre o erro em formato JSON';