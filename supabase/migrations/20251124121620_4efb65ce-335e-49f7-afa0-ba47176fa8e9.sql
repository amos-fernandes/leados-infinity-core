-- Adicionar colunas faltantes na tabela opportunities
ALTER TABLE public.opportunities 
ADD COLUMN IF NOT EXISTS contato_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS data_fechamento_esperada DATE,
ADD COLUMN IF NOT EXISTS observacoes TEXT;