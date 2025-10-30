-- Tabela para armazenar dados diários de novas empresas
CREATE TABLE IF NOT EXISTS public.daily_new_companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  
  -- Dados da empresa
  cnpj TEXT NOT NULL,
  cnpj_raiz TEXT,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  
  -- Datas
  data_abertura DATE NOT NULL,
  data_ingestao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Status e classificação
  situacao_cadastral TEXT,
  porte TEXT,
  mei BOOLEAN DEFAULT false,
  matriz_filial TEXT,
  capital_social NUMERIC,
  
  -- Atividade
  atividade_principal_codigo TEXT,
  atividade_principal_descricao TEXT,
  codigo_natureza_juridica TEXT,
  descricao_natureza_juridica TEXT,
  
  -- Localização
  estado TEXT NOT NULL,
  cidade TEXT,
  logradouro TEXT,
  numero TEXT,
  bairro TEXT,
  cep TEXT,
  
  -- Contatos
  contato_telefonico TEXT,
  contato_telefonico_tipo TEXT,
  contato_email TEXT,
  
  -- Metadados e validação
  fonte_dados TEXT NOT NULL DEFAULT 'manual',
  anomalia_temporal BOOLEAN DEFAULT false,
  anomalia_descricao TEXT,
  dados_validados BOOLEAN DEFAULT false,
  data_validacao TIMESTAMP WITH TIME ZONE,
  
  -- Dados brutos originais
  raw_data JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_daily_companies_cnpj ON public.daily_new_companies(cnpj);
CREATE INDEX idx_daily_companies_data_abertura ON public.daily_new_companies(data_abertura);
CREATE INDEX idx_daily_companies_estado ON public.daily_new_companies(estado);
CREATE INDEX idx_daily_companies_user_id ON public.daily_new_companies(user_id);
CREATE INDEX idx_daily_companies_anomalia ON public.daily_new_companies(anomalia_temporal);
CREATE INDEX idx_daily_companies_data_ingestao ON public.daily_new_companies(data_ingestao);

-- RLS Policies
ALTER TABLE public.daily_new_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own daily companies"
ON public.daily_new_companies
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily companies"
ON public.daily_new_companies
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily companies"
ON public.daily_new_companies
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own daily companies"
ON public.daily_new_companies
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_daily_new_companies_updated_at
BEFORE UPDATE ON public.daily_new_companies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela para estatísticas agregadas diárias
CREATE TABLE IF NOT EXISTS public.daily_companies_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  
  data_referencia DATE NOT NULL,
  estado TEXT NOT NULL,
  total_empresas INTEGER NOT NULL DEFAULT 0,
  
  -- Detalhamento por porte
  total_mei INTEGER DEFAULT 0,
  total_micro INTEGER DEFAULT 0,
  total_pequeno INTEGER DEFAULT 0,
  total_medio INTEGER DEFAULT 0,
  total_grande INTEGER DEFAULT 0,
  
  -- Flags de qualidade
  tem_anomalia BOOLEAN DEFAULT false,
  dados_validados BOOLEAN DEFAULT false,
  
  fonte_dados TEXT NOT NULL DEFAULT 'manual',
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, data_referencia, estado)
);

-- Índices para estatísticas
CREATE INDEX idx_daily_stats_data ON public.daily_companies_stats(data_referencia);
CREATE INDEX idx_daily_stats_estado ON public.daily_companies_stats(estado);
CREATE INDEX idx_daily_stats_user ON public.daily_companies_stats(user_id);

-- RLS para estatísticas
ALTER TABLE public.daily_companies_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own stats"
ON public.daily_companies_stats
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stats"
ON public.daily_companies_stats
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stats"
ON public.daily_companies_stats
FOR UPDATE
USING (auth.uid() = user_id);

-- Trigger para estatísticas
CREATE TRIGGER update_daily_companies_stats_updated_at
BEFORE UPDATE ON public.daily_companies_stats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para detectar anomalias temporais
CREATE OR REPLACE FUNCTION public.detect_temporal_anomaly(abertura_date DATE)
RETURNS BOOLEAN AS $$
BEGIN
  -- Retorna TRUE se a data de abertura é futura
  RETURN abertura_date > CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;