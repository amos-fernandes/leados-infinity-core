-- Criar tabela para armazenar knowledge base das campanhas
CREATE TABLE IF NOT EXISTS public.campaign_knowledge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.campaign_knowledge ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own knowledge base" 
ON public.campaign_knowledge 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own knowledge base" 
ON public.campaign_knowledge 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own knowledge base" 
ON public.campaign_knowledge 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own knowledge base" 
ON public.campaign_knowledge 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for timestamp updates
CREATE TRIGGER update_campaign_knowledge_updated_at
BEFORE UPDATE ON public.campaign_knowledge
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar colunas às tabelas existentes para melhorar qualificação
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS qualification_score TEXT,
ADD COLUMN IF NOT EXISTS urgency_level TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS best_contact_time TEXT,
ADD COLUMN IF NOT EXISTS approach_strategy TEXT,
ADD COLUMN IF NOT EXISTS estimated_revenue TEXT;