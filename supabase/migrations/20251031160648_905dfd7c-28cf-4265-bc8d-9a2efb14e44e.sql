-- Criar tabelas para suporte às novas funcionalidades de captação ética

-- Cache de dados de fontes públicas
CREATE TABLE IF NOT EXISTS public.data_source_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cache_key TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('jucesp', 'rfb', 'other')),
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_data_source_cache_key ON public.data_source_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_data_source_cache_user ON public.data_source_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_data_source_cache_expires ON public.data_source_cache(expires_at);

-- Logs de compliance LGPD
CREATE TABLE IF NOT EXISTS public.compliance_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB,
  legal_basis TEXT NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_logs_user ON public.compliance_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_compliance_logs_action ON public.compliance_logs(action);
CREATE INDEX IF NOT EXISTS idx_compliance_logs_created ON public.compliance_logs(created_at);

-- Metadados de sincronização RFB
CREATE TABLE IF NOT EXISTS public.rfb_sync_metadata (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dataset_version TEXT NOT NULL,
  last_sync TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  file_size_mb NUMERIC,
  records_count INTEGER,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rfb_sync_metadata_status ON public.rfb_sync_metadata(status);

-- Cache de empresas RFB (tabela otimizada para consultas)
CREATE TABLE IF NOT EXISTS public.rfb_companies_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cnpj TEXT NOT NULL UNIQUE,
  cnpj_raiz TEXT,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  data_abertura DATE NOT NULL,
  estado TEXT NOT NULL,
  cidade TEXT,
  situacao_cadastral TEXT,
  porte TEXT,
  atividade_principal TEXT,
  natureza_juridica TEXT,
  capital_social NUMERIC,
  mei BOOLEAN DEFAULT false,
  dados_completos JSONB,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rfb_companies_cnpj ON public.rfb_companies_cache(cnpj);
CREATE INDEX IF NOT EXISTS idx_rfb_companies_data_estado ON public.rfb_companies_cache(data_abertura, estado);
CREATE INDEX IF NOT EXISTS idx_rfb_companies_razao ON public.rfb_companies_cache USING gin(to_tsvector('portuguese', razao_social));

-- Enable RLS
ALTER TABLE public.data_source_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfb_sync_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfb_companies_cache ENABLE ROW LEVEL SECURITY;

-- Policies para data_source_cache
CREATE POLICY "Users can view their own cache"
  ON public.data_source_cache FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cache"
  ON public.data_source_cache FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cache"
  ON public.data_source_cache FOR UPDATE
  USING (auth.uid() = user_id);

-- Policies para compliance_logs (somente inserção e visualização)
CREATE POLICY "Users can view their own compliance logs"
  ON public.compliance_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own compliance logs"
  ON public.compliance_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policies para rfb_sync_metadata (leitura pública para usuários autenticados)
CREATE POLICY "Authenticated users can view RFB sync metadata"
  ON public.rfb_sync_metadata FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Policies para rfb_companies_cache (leitura pública para usuários autenticados)
CREATE POLICY "Authenticated users can view RFB companies cache"
  ON public.rfb_companies_cache FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Function para limpar cache expirado (executar via cron)
CREATE OR REPLACE FUNCTION public.clean_expired_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.data_source_cache
  WHERE expires_at < now();
END;
$$;