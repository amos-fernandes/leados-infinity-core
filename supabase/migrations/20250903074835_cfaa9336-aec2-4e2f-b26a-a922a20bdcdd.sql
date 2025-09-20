-- Criar tabela de campanhas
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'ativa',
  target_companies TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de roteiros de campanha
CREATE TABLE public.campaign_scripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL,
  empresa TEXT NOT NULL,
  roteiro_ligacao TEXT NOT NULL,
  modelo_email TEXT NOT NULL,
  assunto_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  whatsapp_sent BOOLEAN DEFAULT false,
  email_sent BOOLEAN DEFAULT false,
  call_made BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE
);

-- Habilitar RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_scripts ENABLE ROW LEVEL SECURITY;

-- Políticas para campaigns
CREATE POLICY "Users can view their own campaigns" 
ON public.campaigns 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own campaigns" 
ON public.campaigns 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns" 
ON public.campaigns 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns" 
ON public.campaigns 
FOR DELETE 
USING (auth.uid() = user_id);

-- Políticas para campaign_scripts
CREATE POLICY "Users can view their own campaign scripts" 
ON public.campaign_scripts 
FOR SELECT 
USING (
  campaign_id IN (
    SELECT id FROM public.campaigns WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own campaign scripts" 
ON public.campaign_scripts 
FOR INSERT 
WITH CHECK (
  campaign_id IN (
    SELECT id FROM public.campaigns WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own campaign scripts" 
ON public.campaign_scripts 
FOR UPDATE 
USING (
  campaign_id IN (
    SELECT id FROM public.campaigns WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own campaign scripts" 
ON public.campaign_scripts 
FOR DELETE 
USING (
  campaign_id IN (
    SELECT id FROM public.campaigns WHERE user_id = auth.uid()
  )
);

-- Triggers para updated_at
CREATE TRIGGER update_campaigns_updated_at
BEFORE UPDATE ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campaign_scripts_updated_at
BEFORE UPDATE ON public.campaign_scripts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();