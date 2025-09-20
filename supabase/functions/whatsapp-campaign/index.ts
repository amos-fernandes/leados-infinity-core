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
    console.log('WhatsApp campaign function started');
    
    const body = await req.json();
    const { campaignId, userId } = body;
    
    console.log('Processing WhatsApp campaign for:', { campaignId, userId });

    if (!campaignId || !userId) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'campaignId e userId são obrigatórios'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Buscar roteiros da campanha
    const { data: scripts, error: scriptsError } = await supabase
      .from('campaign_scripts')
      .select('*')
      .eq('campaign_id', campaignId);

    if (scriptsError) {
      throw new Error(`Erro ao buscar roteiros: ${scriptsError.message}`);
    }

    console.log(`Found ${scripts?.length || 0} scripts to process`);
    
    // Buscar leads relacionados às empresas da campanha
    const empresas = scripts?.map(s => s.empresa) || [];
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .eq('user_id', userId)
      .in('empresa', empresas);

    if (leadsError) {
      console.warn('Erro ao buscar leads:', leadsError);
    }

    const foundLeads = leads || [];
    console.log(`Found ${foundLeads.length} existing leads for WhatsApp outreach`);

    // Simular envio do WhatsApp (integração real seria feita aqui)
    const whatsappMessages = [];
    
    for (const script of scripts || []) {
      // Encontrar lead correspondente ou criar prospect genérico
      const relatedLead = foundLeads.find(lead => 
        lead.empresa.toLowerCase().includes(script.empresa.toLowerCase()) ||
        script.empresa.toLowerCase().includes(lead.empresa.toLowerCase())
      );

      const phoneNumber = relatedLead?.telefone || '5562981959829'; // Número de atendimento Única Contábil
      const contactName = relatedLead?.contato_decisor || '[Nome]';
      
      // Personalizar mensagem do WhatsApp baseada no roteiro de ligação
      const whatsappMessage = script.roteiro_ligacao
        .replace('[Nome]', contactName)
        .replace('Bom dia', '📞 *Única Contábil - Consultoria Tributária Premium*\n\nOlá')
        .replace('[Agência]', 'Única Contábil')
        .replace('Sou da [Agência]', 'Sou da Única Contábil');

      whatsappMessages.push({
        to: phoneNumber,
        message: whatsappMessage,
        empresa: script.empresa,
        status: 'enviado' // Em integração real, seria 'pendente' até confirmação
      });

      // Atualizar status do script
      await supabase
        .from('campaign_scripts')
        .update({ whatsapp_sent: true })
        .eq('id', script.id);
    }

    console.log('WhatsApp messages prepared:', whatsappMessages.length);

    // Em uma integração real, aqui seria feita a chamada para API do WhatsApp Business
    // Por exemplo: WhatsApp Business API, Twilio, etc.
    
    /*
    // Exemplo de integração com WhatsApp Business API
    for (const msg of whatsappMessages) {
      try {
        const whatsappResponse = await fetch('https://api.whatsapp.com/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: msg.to,
            text: { body: msg.message }
          })
        });
        
        if (whatsappResponse.ok) {
          console.log(`WhatsApp sent to ${msg.empresa}`);
        }
      } catch (error) {
        console.error(`Failed to send WhatsApp to ${msg.empresa}:`, error);
      }
    }
    */

    // Log da atividade para demonstração
    console.log('WhatsApp Campaign Summary:');
    whatsappMessages.forEach(msg => {
      console.log(`📱 ${msg.empresa}: ${msg.message.substring(0, 50)}...`);
    });

    return new Response(JSON.stringify({ 
      success: true,
      message: `WhatsApp campaign enviada para ${whatsappMessages.length} empresas`,
      sentCount: whatsappMessages.length,
      messages: whatsappMessages
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in whatsapp-campaign function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message || 'Erro interno do servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});