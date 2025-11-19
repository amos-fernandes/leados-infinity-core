import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method === 'POST') {
      const { userId } = await req.json();
      
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'userId é obrigatório' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      console.log(`Iniciando processo de conexão WhatsApp para usuário: ${userId}`);

      // Registrar tentativa de conexão no banco
      try {
        await supabase
          .from('whatsapp_config')
          .upsert({
            user_id: userId,
            phone_number: `connecting_${userId}`,
            webhook_url: `${supabaseUrl}/functions/v1/whatsapp-websocket`,
            access_token: 'pending',
            is_active: false,
            business_account_id: `session_${userId}`,
            updated_at: new Date().toISOString()
          });

        await supabase
          .from('campaign_knowledge')
          .insert({
            user_id: userId,
            content: `WhatsApp connection API called - User: ${userId} - Status: initiated`,
            generated_at: new Date().toISOString()
          });
      } catch (dbError) {
        console.error('Database error:', dbError);
      }

      return new Response(
        JSON.stringify({ 
          message: 'Processo de conexão iniciado. Verifique seu dashboard para o QR Code.',
          userId,
          status: 'initiated'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const userId = url.searchParams.get('userId');
      
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'userId é obrigatório' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Buscar status da conexão no banco
      try {
        const { data, error } = await supabase
          .from('whatsapp_config')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        const status = data ? (data.is_active ? 'CONNECTED' : 'DISCONNECTED') : 'NOT_CONFIGURED';

        return new Response(
          JSON.stringify({ 
            userId,
            status,
            config: data || null
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      } catch (dbError) {
        console.error('Database error:', dbError);
        return new Response(
          JSON.stringify({ 
            userId,
            status: 'ERROR',
            error: 'Erro ao consultar status'
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    if (req.method === 'DELETE') {
      const { userId } = await req.json();
      
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'userId é obrigatório' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      console.log(`Desconectando WhatsApp para usuário: ${userId}`);

      // Atualizar status no banco
      try {
        await supabase
          .from('whatsapp_config')
          .update({ 
            is_active: false,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        await supabase
          .from('campaign_knowledge')
          .insert({
            user_id: userId,
            content: `WhatsApp disconnection API called - User: ${userId} - Status: disconnected`,
            generated_at: new Date().toISOString()
          });
      } catch (dbError) {
        console.error('Database error:', dbError);
      }

      return new Response(
        JSON.stringify({ 
          message: 'WhatsApp desconectado com sucesso.',
          userId,
          status: 'disconnected'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Erro interno do servidor' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});