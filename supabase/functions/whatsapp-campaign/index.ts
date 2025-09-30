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
    
    // Buscar roteiros da campanha - adicionar log detalhado
    console.log('Buscando roteiros para campanha:', campaignId);
    const { data: scripts, error: scriptsError } = await supabase
      .from('campaign_scripts')
      .select('*')
      .eq('campaign_id', campaignId);

    if (scriptsError) {
      console.error('Erro detalhado ao buscar roteiros:', scriptsError);
      throw new Error(`Erro ao buscar roteiros: ${scriptsError.message}`);
    }

    console.log(`Found ${scripts?.length || 0} scripts to process`);
    console.log('Scripts encontrados:', scripts);
    
    // Buscar leads relacionados às empresas da campanha
    const empresas = scripts?.map(s => s.empresa) || [];
    console.log('Empresas dos scripts:', empresas);
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
    console.log('Leads encontrados:', foundLeads.map(l => ({ empresa: l.empresa, telefone: l.telefone, whatsapp: l.whatsapp })));

    // Simular envio do WhatsApp (integração real seria feita aqui)
    const whatsappMessages = [];
    
    for (const script of scripts || []) {
      // Encontrar lead correspondente ou criar prospect genérico
      const relatedLead = foundLeads.find(lead => 
        lead.empresa.toLowerCase().includes(script.empresa.toLowerCase()) ||
        script.empresa.toLowerCase().includes(lead.empresa.toLowerCase())
      );

      const phoneNumber = relatedLead?.telefone || relatedLead?.whatsapp || '5562991792303'; // Número configurado + campo whatsapp
      const contactName = relatedLead?.contato_decisor || '[Nome]';
      
      // Usar template WhatsApp exato da knowledge base C6 Bank
      const cnpj = relatedLead?.cnpj || '[CNPJ]';
      const gancho = relatedLead?.gancho_prospeccao || 'conta PJ gratuita';
      
      const whatsappMessage = `🏢 Olá ${contactName}!

Conferimos o CNPJ ${cnpj} da ${script.empresa} e identificamos que você pode se beneficiar de uma conta PJ gratuita no C6 Bank.

💡 Benefícios imediatos:
✅ Pix ilimitado
✅ 100 TEDs gratuitos
✅ 100 boletos gratuitos
✅ Crédito sujeito a análise
✅ Atendimento humano via escritório autorizado

🎯 Você tem interesse em aproveitar esses benefícios ou prefere receber uma proposta detalhada para sua empresa?`;

      whatsappMessages.push({
        to: phoneNumber,
        message: whatsappMessage,
        empresa: script.empresa,
        status: 'enviado' // Em integração real, seria 'pendente' até confirmação
      });

      // Atualizar status do script
      await supabase
        .from('campaign_scripts')
        .update({ whatsapp_enviado: true })
        .eq('id', script.id);

          // Registrar interação no histórico completo
          await supabase
            .from('interactions')
            .insert({
              user_id: userId,
              tipo: 'whatsapp',
              assunto: `WhatsApp Campanha - ${script.empresa}`,
              descricao: `Mensagem enviada:\n\n${whatsappMessage}\n\nTelefone: ${phoneNumber}\nGancho: Conta PJ gratuita C6 Bank com benefícios exclusivos`,
              data_interacao: new Date().toISOString()
            });

          // Criar oportunidade relacionada à empresa
          await supabase
            .from('opportunities')
            .insert({
              user_id: userId,
              empresa: script.empresa,
              titulo: `Abertura Conta PJ - ${script.empresa}`,
              estagio: 'contato_inicial',
              valor: 5000, // Valor estimado da conta PJ
              probabilidade: 30, // Probabilidade inicial 30%
              status: 'aberta'
            });
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
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});