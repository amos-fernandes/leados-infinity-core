-- Adicionar coluna bant_analysis na tabela leads se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' 
                   AND column_name = 'bant_analysis' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.leads ADD COLUMN bant_analysis jsonb;
        
        -- Criar índice para otimizar consultas no campo bant_analysis
        CREATE INDEX IF NOT EXISTS idx_leads_bant_analysis ON public.leads USING GIN(bant_analysis);
        
        RAISE NOTICE 'Coluna bant_analysis adicionada à tabela leads';
    ELSE
        RAISE NOTICE 'Coluna bant_analysis já existe na tabela leads';
    END IF;
END $$;