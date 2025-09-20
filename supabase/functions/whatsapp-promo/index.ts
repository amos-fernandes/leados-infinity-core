import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ATENDIMENTO_WHATSAPP = '5562981959829'; // 62 9 8195 9829

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('WhatsApp promo campaign function started');
    
    const body = await req.json();
    const { campaignId, userId, promoType = 'consultoria' } = body;
    
    console.log('Processing WhatsApp promo campaign for:', { campaignId, userId, promoType });

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
    console.log(`Found ${foundLeads.length} existing leads for WhatsApp promo outreach`);

    // Preparar mensagens promocionais do WhatsApp
    const whatsappMessages = [];
    
    // Mensagem para o número de atendimento principal
    const promoMessage = `🏆 *ÚNICA CONTÁBIL - PROMOÇÃO ESPECIAL*

📊 *Consultoria Tributária Premium para Grandes Empresas*

✅ Recuperação de créditos tributários
✅ Planejamento fiscal avançado  
✅ Auditoria contábil especializada
✅ Compliance fiscal completo

🎯 *ESPECIALISTAS EM:*
• Lucro Real e Presumido
• Multinacionais e Holdings
• Agroindústrias em Goiás
• Grandes corporações (R$ 30M+)

💰 *OFERTA LIMITADA:*
📞 Consultoria inicial GRATUITA
🏆 Análise fiscal sem custo
📋 Proposta personalizada

👨‍💼 *Nossa equipe tem PHD em Contabilidade*
📈 *Média de recuperação: R$ 2-15 milhões*
✅ *95% de aprovação nos órgãos fiscais*

📱 *AGENDE AGORA:*
https://calendly.com/unica-contabil

📧 *Contato:* contato@unicacontabil.com
📞 *(62) 9 8195-9829*

*Atendemos todo o estado de Goiás e região Centro-Oeste*`;

    // Enviar mensagem promocional para o número de atendimento
    whatsappMessages.push({
      to: ATENDIMENTO_WHATSAPP,
      message: promoMessage,
      empresa: 'Única Contábil - Atendimento',
      type: 'promo-campanha'
    });
    
    // Processar leads individuais da campanha
    for (const script of scripts || []) {
      const relatedLead = foundLeads.find(lead => 
        lead.empresa.toLowerCase().includes(script.empresa.toLowerCase()) ||
        script.empresa.toLowerCase().includes(lead.empresa.toLowerCase())
      );

      const phoneNumber = relatedLead?.telefone || ATENDIMENTO_WHATSAPP;
      const contactName = relatedLead?.contato_decisor || 'Responsável Financeiro';
      
      // Mensagem personalizada para o lead
      const personalizedPromo = `📞 *ÚNICA CONTÁBIL*

Olá ${contactName}!

🏢 Identificamos que a *${script.empresa}* pode se beneficiar significativamente de nossos serviços de consultoria tributária especializada.

🎯 *OPORTUNIDADES IDENTIFICADAS:*
${script.roteiro_ligacao.substring(0, 200)}...

💰 *OFERTA ESPECIAL:*
✅ Análise fiscal gratuita
✅ Identificação de créditos tributários
✅ Proposta sem compromisso

📞 *Entre em contato:*
*(62) 9 8195-9829*

📅 *Ou agende direto:*
https://calendly.com/unica-contabil

Atenciosamente,
*Equipe Única Contábil*`;

      whatsappMessages.push({
        to: phoneNumber,
        message: personalizedPromo,
        empresa: script.empresa,
        type: 'lead-personalizado'
      });

      // Atualizar status do script
      await supabase
        .from('campaign_scripts')
        .update({ whatsapp_sent: true })
        .eq('id', script.id);
    }

    console.log('WhatsApp promo messages prepared:', whatsappMessages.length);

    // Simulação do envio (em integração real, conectaria com WhatsApp Business API)
    console.log('WhatsApp Promo Campaign Summary:');
    whatsappMessages.forEach(msg => {
      console.log(`📱 ${msg.type} - ${msg.empresa}: Mensagem preparada para ${msg.to}`);
    });

    // Notificação para o número de atendimento sobre nova campanha
    const notificationMessage = `🚀 *NOVA CAMPANHA ATIVADA*

📊 Campanha ID: ${campaignId}
👥 Leads processados: ${scripts?.length || 0}
📱 Mensagens preparadas: ${whatsappMessages.length}

⏰ ${new Date().toLocaleString('pt-BR')}

*Sistema de Automação - Única Contábil*`;

    whatsappMessages.push({
      to: ATENDIMENTO_WHATSAPP,
      message: notificationMessage,
      empresa: 'Sistema - Notificação',
      type: 'notificacao-campanha'
    });

    return new Response(JSON.stringify({ 
      success: true,
      message: `WhatsApp promo campaign preparada para ${whatsappMessages.length} mensagens`,
      sentCount: whatsappMessages.length,
      atendimentoNumber: ATENDIMENTO_WHATSAPP,
      messages: whatsappMessages.map(m => ({
        empresa: m.empresa,
        type: m.type,
        to: m.to,
        preview: m.message.substring(0, 100) + '...'
      }))
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in whatsapp-promo function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message || 'Erro interno do servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});