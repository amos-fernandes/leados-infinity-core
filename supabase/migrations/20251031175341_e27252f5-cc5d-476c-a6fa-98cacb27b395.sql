-- Expandir constraint de status para incluir todos os status do pipeline
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;

ALTER TABLE leads ADD CONSTRAINT leads_status_check 
CHECK (status IN (
  'novo',           -- Lead inicial
  'PROCESSING',     -- Em processamento
  'qualificado',    -- Qualificado
  'desqualificado', -- Não qualificado
  'contatado',      -- Já foi contatado
  'convertido',     -- Virou cliente
  'ERROR'           -- Erro no processamento
));