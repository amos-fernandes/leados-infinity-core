-- Create leads table for storing prospected leads
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  empresa TEXT NOT NULL,
  setor TEXT,
  cnae TEXT,
  regime_tributario TEXT,
  contato_decisor TEXT,
  telefone TEXT,
  email TEXT,
  website TEXT,
  gancho_prospeccao TEXT,
  status TEXT DEFAULT 'novo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Create policies for leads
CREATE POLICY "Users can view their own leads" 
ON public.leads 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own leads" 
ON public.leads 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own leads" 
ON public.leads 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own leads" 
ON public.leads 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create contacts table for CRM
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  empresa TEXT,
  cargo TEXT,
  email TEXT,
  telefone TEXT,
  website TEXT,
  status TEXT DEFAULT 'ativo',
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for contacts
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Create policies for contacts
CREATE POLICY "Users can view their own contacts" 
ON public.contacts 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own contacts" 
ON public.contacts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contacts" 
ON public.contacts 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contacts" 
ON public.contacts 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create opportunities table for sales pipeline
CREATE TABLE public.opportunities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  empresa TEXT NOT NULL,
  contato_id UUID REFERENCES public.contacts(id),
  valor DECIMAL(10,2),
  probabilidade INTEGER DEFAULT 25,
  estagio TEXT DEFAULT 'lead',
  data_fechamento_esperada DATE,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for opportunities
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- Create policies for opportunities
CREATE POLICY "Users can view their own opportunities" 
ON public.opportunities 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own opportunities" 
ON public.opportunities 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own opportunities" 
ON public.opportunities 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own opportunities" 
ON public.opportunities 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create interactions table for CRM history
CREATE TABLE public.interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contact_id UUID REFERENCES public.contacts(id),
  tipo TEXT NOT NULL,
  assunto TEXT,
  descricao TEXT,
  data_interacao TIMESTAMP WITH TIME ZONE DEFAULT now(),
  proximo_followup DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for interactions
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;

-- Create policies for interactions
CREATE POLICY "Users can view their own interactions" 
ON public.interactions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own interactions" 
ON public.interactions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own interactions" 
ON public.interactions 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own interactions" 
ON public.interactions 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_opportunities_updated_at
BEFORE UPDATE ON public.opportunities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_interactions_updated_at
BEFORE UPDATE ON public.interactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();