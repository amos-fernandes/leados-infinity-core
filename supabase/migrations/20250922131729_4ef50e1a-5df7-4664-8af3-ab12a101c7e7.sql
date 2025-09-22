-- Add missing columns to leads table
ALTER TABLE public.leads ADD COLUMN cnae TEXT;
ALTER TABLE public.leads ADD COLUMN contato_decisor TEXT;

-- Create campaign_knowledge table
CREATE TABLE public.campaign_knowledge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  knowledge_type TEXT DEFAULT 'general' CHECK (knowledge_type IN ('general', 'company', 'objection', 'script')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on campaign_knowledge table
ALTER TABLE public.campaign_knowledge ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for campaign_knowledge
CREATE POLICY "Users can view their own campaign knowledge" ON public.campaign_knowledge FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can create their own campaign knowledge" ON public.campaign_knowledge FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update their own campaign knowledge" ON public.campaign_knowledge FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can delete their own campaign knowledge" ON public.campaign_knowledge FOR DELETE USING (auth.uid()::text = user_id::text);

-- Create trigger for campaign_knowledge timestamp updates
CREATE TRIGGER update_campaign_knowledge_updated_at BEFORE UPDATE ON public.campaign_knowledge FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_campaign_knowledge_user_id ON public.campaign_knowledge(user_id);
CREATE INDEX idx_campaign_knowledge_campaign_id ON public.campaign_knowledge(campaign_id);