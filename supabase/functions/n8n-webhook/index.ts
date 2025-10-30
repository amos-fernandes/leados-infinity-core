import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔗 N8N webhook received');
    
    const payload = await req.json();
    const { action, data } = payload;
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let response;

    switch (action) {
      case 'send_campaign':
        // Enviar campanha via Evolution API
        const { instanceId, leads, message } = data;
        
        for (const lead of leads) {
          if (lead.whatsapp) {
            await supabase.functions.invoke('evolution-send-message', {
              body: {
                instanceId,
                number: lead.whatsapp,
                text: message
              }
            });
          }
        }
        
        response = { success: true, sent: leads.length };
        break;

      case 'update_lead':
        // Atualizar lead no CRM
        const { leadId, updates } = data;
        
        const { error } = await supabase
          .from('leads')
          .update(updates)
          .eq('id', leadId);
        
        if (error) throw error;
        response = { success: true };
        break;

      case 'create_interaction':
        // Criar interação no CRM
        const { userId, leadId: interactionLeadId, tipo, assunto, descricao } = data;
        
        const { error: interactionError } = await supabase
          .from('interactions')
          .insert({
            user_id: userId,
            lead_id: interactionLeadId,
            tipo,
            assunto,
            descricao,
            data_interacao: new Date().toISOString()
          });
        
        if (interactionError) throw interactionError;
        response = { success: true };
        break;

      default:
        response = { success: false, error: 'Unknown action' };
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in n8n-webhook:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
