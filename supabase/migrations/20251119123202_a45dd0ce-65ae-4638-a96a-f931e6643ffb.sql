-- Adicionar colunas faltantes na tabela contacts
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS observacoes TEXT,
ADD COLUMN IF NOT EXISTS website TEXT;