-- Adicionar campo whatsapp na tabela leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS whatsapp_business TEXT;

-- Adicionar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_leads_whatsapp_business ON leads(whatsapp_business);

-- Comentário para documentar o campo
COMMENT ON COLUMN leads.whatsapp_business IS 'WhatsApp Business da empresa - coletado via Google Maps e validação de sites oficiais';