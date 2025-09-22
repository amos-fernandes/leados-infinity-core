-- Adicionar colunas necessárias para o Agno Collector na tabela leads
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS approach_strategy TEXT,
ADD COLUMN IF NOT EXISTS qualification_score TEXT,
ADD COLUMN IF NOT EXISTS bright_data_enriched BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS estimated_employees INTEGER,
ADD COLUMN IF NOT EXISTS tech_stack JSONB,
ADD COLUMN IF NOT EXISTS social_media JSONB;