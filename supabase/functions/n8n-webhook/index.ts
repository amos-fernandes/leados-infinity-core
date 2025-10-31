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

      case 'create_opportunity':
        // Criar oportunidade no CRM a partir de mensagem WhatsApp
        const { userId: oppUserId, leadName, phone, message: oppMessage, valor, probabilidade } = data;
        
        // Criar ou atualizar lead
        const { data: existingLead } = await supabase
          .from('leads')
          .select('id')
          .eq('whatsapp', phone)
          .eq('user_id', oppUserId)
          .single();

        let leadId = existingLead?.id;

        if (!leadId) {
          const { data: newLead, error: leadError } = await supabase
            .from('leads')
            .insert({
              user_id: oppUserId,
              empresa: leadName || `Lead WhatsApp ${phone.slice(-4)}`,
              whatsapp: phone,
              status: 'novo',
              gancho_prospeccao: oppMessage
            })
            .select()
            .single();

          if (leadError) throw leadError;
          leadId = newLead.id;
        }

        // Criar oportunidade
        const { data: opportunity, error: oppError } = await supabase
          .from('opportunities')
          .insert({
            user_id: oppUserId,
            titulo: `Abertura de Conta - ${leadName || phone}`,
            empresa: leadName || `Cliente ${phone.slice(-4)}`,
            valor: valor || 5000,
            probabilidade: probabilidade || 70,
            status: 'aberta',
            estagio: 'contato_inicial'
          })
          .select()
          .single();

        if (oppError) throw oppError;

        // Criar interação
        await supabase
          .from('interactions')
          .insert({
            user_id: oppUserId,
            lead_id: leadId,
            opportunity_id: opportunity.id,
            tipo: 'whatsapp',
            assunto: 'Interesse em Abertura de Conta',
            descricao: `Mensagem recebida: ${oppMessage}`,
            data_interacao: new Date().toISOString()
          });

        response = { 
          success: true, 
          opportunityId: opportunity.id,
          leadId 
        };
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
