-- Create campaigns table
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'ativa' CHECK (status IN ('ativa', 'pausada', 'finalizada')),
  target_companies JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create leads table
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  empresa TEXT NOT NULL,
  setor TEXT,
  gancho_prospeccao TEXT,
  status TEXT DEFAULT 'novo' CHECK (status IN ('novo', 'qualificado', 'contatado', 'convertido')),
  telefone TEXT,
  whatsapp TEXT,
  email TEXT,
  website TEXT,
  linkedin TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contacts table
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  empresa TEXT,
  cargo TEXT,
  email TEXT,
  telefone TEXT,
  linkedin TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create opportunities table
CREATE TABLE public.opportunities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  empresa TEXT NOT NULL,
  valor DECIMAL(10,2),
  status TEXT DEFAULT 'aberta' CHECK (status IN ('aberta', 'ganha', 'perdida')),
  probabilidade INTEGER DEFAULT 50 CHECK (probabilidade >= 0 AND probabilidade <= 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create interactions table
CREATE TABLE public.interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('email', 'ligacao', 'whatsapp', 'reuniao')),
  assunto TEXT NOT NULL,
  descricao TEXT,
  lead_id UUID REFERENCES public.leads(id),
  contact_id UUID REFERENCES public.contacts(id),
  opportunity_id UUID REFERENCES public.opportunities(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create campaign_scripts table
CREATE TABLE public.campaign_scripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  empresa TEXT NOT NULL,
  roteiro_ligacao TEXT,
  modelo_email TEXT,
  assunto_email TEXT,
  whatsapp_enviado BOOLEAN DEFAULT FALSE,
  email_enviado BOOLEAN DEFAULT FALSE,
  ligacao_feita BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_scripts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for campaigns
CREATE POLICY "Users can view their own campaigns" ON public.campaigns FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can create their own campaigns" ON public.campaigns FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update their own campaigns" ON public.campaigns FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can delete their own campaigns" ON public.campaigns FOR DELETE USING (auth.uid()::text = user_id::text);

-- Create RLS policies for leads
CREATE POLICY "Users can view their own leads" ON public.leads FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can create their own leads" ON public.leads FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update their own leads" ON public.leads FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can delete their own leads" ON public.leads FOR DELETE USING (auth.uid()::text = user_id::text);

-- Create RLS policies for contacts
CREATE POLICY "Users can view their own contacts" ON public.contacts FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can create their own contacts" ON public.contacts FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update their own contacts" ON public.contacts FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can delete their own contacts" ON public.contacts FOR DELETE USING (auth.uid()::text = user_id::text);

-- Create RLS policies for opportunities
CREATE POLICY "Users can view their own opportunities" ON public.opportunities FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can create their own opportunities" ON public.opportunities FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update their own opportunities" ON public.opportunities FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can delete their own opportunities" ON public.opportunities FOR DELETE USING (auth.uid()::text = user_id::text);

-- Create RLS policies for interactions
CREATE POLICY "Users can view their own interactions" ON public.interactions FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can create their own interactions" ON public.interactions FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update their own interactions" ON public.interactions FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can delete their own interactions" ON public.interactions FOR DELETE USING (auth.uid()::text = user_id::text);

-- Create RLS policies for campaign_scripts
CREATE POLICY "Users can view scripts from their campaigns" ON public.campaign_scripts FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.campaigns c 
    WHERE c.id = campaign_scripts.campaign_id 
    AND auth.uid()::text = c.user_id::text
  )
);

CREATE POLICY "Users can create scripts for their campaigns" ON public.campaign_scripts FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.campaigns c 
    WHERE c.id = campaign_scripts.campaign_id 
    AND auth.uid()::text = c.user_id::text
  )
);

CREATE POLICY "Users can update scripts from their campaigns" ON public.campaign_scripts FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.campaigns c 
    WHERE c.id = campaign_scripts.campaign_id 
    AND auth.uid()::text = c.user_id::text
  )
);

CREATE POLICY "Users can delete scripts from their campaigns" ON public.campaign_scripts FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.campaigns c 
    WHERE c.id = campaign_scripts.campaign_id 
    AND auth.uid()::text = c.user_id::text
  )
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX idx_leads_user_id ON public.leads(user_id);
CREATE INDEX idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX idx_opportunities_user_id ON public.opportunities(user_id);
CREATE INDEX idx_interactions_user_id ON public.interactions(user_id);
CREATE INDEX idx_campaign_scripts_campaign_id ON public.campaign_scripts(campaign_id);