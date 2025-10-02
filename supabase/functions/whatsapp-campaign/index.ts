import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

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
    
    console.log('📱 Processing WhatsApp campaign:', { campaignId, userId });

    if (!campaignId || !userId) {
      console.error('❌ Missing required parameters:', { campaignId, userId });
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
    
    console.log('✅ Supabase config loaded');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Buscar roteiros da campanha
    console.log('🔍 Buscando roteiros para campanha:', campaignId);
    const { data: scripts, error: scriptsError } = await supabase
      .from('campaign_scripts')
      .select('*')
      .eq('campaign_id', campaignId);

    if (scriptsError) {
      console.error('❌ Erro ao buscar roteiros:', scriptsError);
      throw new Error(`Erro ao buscar roteiros: ${scriptsError.message}`);
    }

    if (!scripts || scripts.length === 0) {
      console.error('❌ Nenhum script encontrado para a campanha');
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Nenhum script encontrado para esta campanha'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`✅ ${scripts.length} scripts encontrados`);
    
    // Buscar leads relacionados às empresas da campanha
    const empresas = scripts.map(s => s.empresa);
    console.log('🔍 Buscando leads para empresas:', empresas);
    
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .eq('user_id', userId)
      .in('empresa', empresas);

    if (leadsError) {
      console.warn('⚠️ Erro ao buscar leads:', leadsError);
    }

    const foundLeads = leads || [];
    console.log(`✅ ${foundLeads.length} leads encontrados`);

    // Processar envio do WhatsApp
    const whatsappMessages = [];
    let successCount = 0;
    let errorCount = 0;
    
    for (const script of scripts) {
      try {
        // Encontrar lead correspondente
        const relatedLead = foundLeads.find(lead => 
          lead.empresa.toLowerCase().includes(script.empresa.toLowerCase()) ||
          script.empresa.toLowerCase().includes(lead.empresa.toLowerCase())
        );

        if (!relatedLead) {
          console.warn(`⚠️ Lead não encontrado para: ${script.empresa}`);
          errorCount++;
          continue;
        }

        // Validar número de telefone
        const phoneNumber = relatedLead.whatsapp || relatedLead.telefone;
        if (!phoneNumber) {
          console.warn(`⚠️ Sem telefone para: ${script.empresa}`);
          errorCount++;
          continue;
        }

        const cleanPhone = phoneNumber.replace(/\D/g, '');
        if (cleanPhone.length < 10) {
          console.warn(`⚠️ Telefone inválido para ${script.empresa}: ${phoneNumber}`);
          errorCount++;
          continue;
        }
        
        const contactName = relatedLead.contato_decisor || '[Responsável]';
        const cnpj = relatedLead.cnpj || '[CNPJ]';
        
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
          to: cleanPhone,
          message: whatsappMessage,
          empresa: script.empresa,
          lead_id: relatedLead.id
        });

        // Atualizar status do script
        await supabase
          .from('campaign_scripts')
          .update({ whatsapp_enviado: true })
          .eq('id', script.id);

        // Registrar interação
        await supabase
          .from('interactions')
          .insert({
            user_id: userId,
            lead_id: relatedLead.id,
            tipo: 'whatsapp',
            assunto: `WhatsApp Campanha - ${script.empresa}`,
            descricao: `Mensagem enviada:\n\n${whatsappMessage}\n\nTelefone: ${phoneNumber}`,
            data_interacao: new Date().toISOString()
          });

        // Criar oportunidade
        await supabase
          .from('opportunities')
          .insert({
            user_id: userId,
            empresa: script.empresa,
            titulo: `Abertura Conta PJ - ${script.empresa}`,
            estagio: 'contato_inicial',
            valor: 5000,
            probabilidade: 30,
            status: 'aberta'
          });

        console.log(`✅ WhatsApp preparado para ${script.empresa} (${cleanPhone})`);
        successCount++;
        
      } catch (error) {
        console.error(`❌ Erro ao processar ${script.empresa}:`, error);
        errorCount++;
      }
    }


    console.log(`📊 Resumo: ${successCount} enviados, ${errorCount} erros`);

    return new Response(JSON.stringify({ 
      success: true,
      message: `WhatsApp campaign processada: ${successCount} mensagens preparadas, ${errorCount} erros`,
      successCount,
      errorCount,
      totalScripts: scripts.length,
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