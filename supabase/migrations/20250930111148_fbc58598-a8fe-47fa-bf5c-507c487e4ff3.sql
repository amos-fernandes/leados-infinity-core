-- Adicionar colunas necessárias para qualificação de leads com IA
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS estimated_revenue text,
ADD COLUMN IF NOT EXISTS recommended_channel text,
ADD COLUMN IF NOT EXISTS next_steps jsonb,
ADD COLUMN IF NOT EXISTS qualification_level text,
ADD COLUMN IF NOT EXISTS qualified_at timestamp with time zone;

-- Criar índices para otimizar consultas
CREATE INDEX IF NOT EXISTS idx_leads_qualification_level ON public.leads(qualification_level);
CREATE INDEX IF NOT EXISTS idx_leads_qualified_at ON public.leads(qualified_at);
CREATE INDEX IF NOT EXISTS idx_leads_next_steps ON public.leads USING GIN(next_steps);