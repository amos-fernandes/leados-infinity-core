-- Criar tabela para meetings agendados se não existir
CREATE TABLE IF NOT EXISTS scheduled_meetings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  lead_id UUID,
  lead_name TEXT NOT NULL,
  lead_email TEXT NOT NULL,
  scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
  meeting_type TEXT DEFAULT 'call',
  duration_minutes INTEGER DEFAULT 60,
  status TEXT DEFAULT 'agendado',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE scheduled_meetings ENABLE ROW LEVEL SECURITY;

-- Criar política de acesso
CREATE POLICY "Users can manage their own meetings" 
ON scheduled_meetings FOR ALL 
USING (auth.uid() = user_id);