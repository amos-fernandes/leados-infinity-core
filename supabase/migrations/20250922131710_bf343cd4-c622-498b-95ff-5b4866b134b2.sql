-- Create whatsapp_config table
CREATE TABLE public.whatsapp_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  phone_number TEXT,
  webhook_url TEXT,
  access_token TEXT,
  verify_token TEXT,
  business_account_id TEXT,
  phone_number_id TEXT,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create whatsapp_messages table
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  sender_name TEXT,
  message_content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'document', 'audio', 'video')),
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  response_sent BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on WhatsApp tables
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for whatsapp_config
CREATE POLICY "Users can view their own WhatsApp config" ON public.whatsapp_config FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own WhatsApp config" ON public.whatsapp_config FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own WhatsApp config" ON public.whatsapp_config FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own WhatsApp config" ON public.whatsapp_config FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for whatsapp_messages
CREATE POLICY "Users can view their own WhatsApp messages" ON public.whatsapp_messages FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can create their own WhatsApp messages" ON public.whatsapp_messages FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update their own WhatsApp messages" ON public.whatsapp_messages FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can delete their own WhatsApp messages" ON public.whatsapp_messages FOR DELETE USING (auth.uid()::text = user_id::text);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_whatsapp_config_updated_at BEFORE UPDATE ON public.whatsapp_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_whatsapp_config_user_id ON public.whatsapp_config(user_id);
CREATE INDEX idx_whatsapp_messages_user_id ON public.whatsapp_messages(user_id);
CREATE INDEX idx_whatsapp_messages_phone_number ON public.whatsapp_messages(phone_number);
CREATE INDEX idx_whatsapp_messages_created_at ON public.whatsapp_messages(created_at DESC);