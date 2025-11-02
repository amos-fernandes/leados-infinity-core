import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    
    console.log('📨 Webhook LEADOS recebido:', {
      method: req.method,
      headers: Object.fromEntries(req.headers.entries()),
      payloadPreview: JSON.stringify(payload).substring(0, 200)
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Identifica o tipo de fluxo baseado no payload
    const flowType = payload.flowType || payload.type || 'generic';
    const action = payload.action || 'webhook_received';

    console.log('🔍 Tipo de fluxo identificado:', flowType);

    // Processa baseado no tipo de fluxo
    let result;
    
    switch (flowType) {
      case 'lead_collection':
      case 'collect_leads':
        result = await processLeadCollection(supabase, payload);
        break;
      
      case 'lead_qualification':
        result = await processLeadQualification(supabase, payload);
        break;
      
      case 'campaign_dispatch':
        result = await processCampaignDispatch(supabase, payload);
        break;
      
      case 'data_enrichment':
        result = await processDataEnrichment(supabase, payload);
        break;
      
      default:
        // Armazena webhook genérico para análise posterior
        result = await processGenericWebhook(supabase, payload);
    }

    console.log('✅ Webhook processado com sucesso:', result);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Webhook processado com sucesso',
        flowType,
        result
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Erro ao processar webhook:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

async function processLeadCollection(supabase: any, payload: any) {
  console.log('📊 Processando coleta de leads...');
  
  const leads = payload.leads || payload.data || [];
  const insertedLeads = [];
  
  for (const lead of leads) {
    try {
      // Insere no CRM (tabela contacts)
      const { data, error } = await supabase
        .from('contacts')
        .upsert({
          company_name: lead.company_name || lead.name,
          email: lead.email,
          phone: lead.phone || lead.telefone,
          cnpj: lead.cnpj,
          source: 'n8n_webhook',
          status: 'new',
          created_at: new Date().toISOString()
        }, { onConflict: 'cnpj' });
      
      if (error) {
        console.error('Erro ao inserir lead:', error);
      } else {
        insertedLeads.push(data);
      }
    } catch (err) {
      console.error('Erro no processamento do lead:', err);
    }
  }
  
  return {
    processedCount: leads.length,
    insertedCount: insertedLeads.length,
    type: 'lead_collection'
  };
}

async function processLeadQualification(supabase: any, payload: any) {
  console.log('🎯 Processando qualificação de leads...');
  
  const leadId = payload.leadId || payload.id;
  const score = payload.score || payload.qualificationScore;
  const status = payload.status || 'qualified';
  
  const { data, error } = await supabase
    .from('contacts')
    .update({
      qualification_score: score,
      status: status,
      updated_at: new Date().toISOString()
    })
    .eq('id', leadId);
  
  if (error) throw error;
  
  return {
    leadId,
    score,
    status,
    type: 'lead_qualification'
  };
}

async function processCampaignDispatch(supabase: any, payload: any) {
  console.log('📢 Processando disparo de campanha...');
  
  const campaignData = {
    user_id: payload.userId,
    name: payload.campaignName || 'Campanha n8n',
    status: payload.status || 'active',
    type: payload.campaignType || 'whatsapp',
    results: payload.results || {},
    created_at: new Date().toISOString()
  };
  
  const { data, error } = await supabase
    .from('interactions')
    .insert({
      user_id: payload.userId,
      tipo: 'campaign',
      assunto: `Campanha: ${campaignData.name}`,
      descricao: JSON.stringify(payload),
      created_at: new Date().toISOString()
    });
  
  if (error) throw error;
  
  return {
    campaign: campaignData,
    type: 'campaign_dispatch'
  };
}

async function processDataEnrichment(supabase: any, payload: any) {
  console.log('📈 Processando enriquecimento de dados...');
  
  const cnpj = payload.cnpj;
  const enrichedData = payload.data || payload.enrichment;
  
  const { data, error } = await supabase
    .from('contacts')
    .update({
      ...enrichedData,
      updated_at: new Date().toISOString()
    })
    .eq('cnpj', cnpj);
  
  if (error) throw error;
  
  return {
    cnpj,
    fieldsUpdated: Object.keys(enrichedData).length,
    type: 'data_enrichment'
  };
}

async function processGenericWebhook(supabase: any, payload: any) {
  console.log('📦 Processando webhook genérico...');
  
  // Armazena o webhook completo para análise
  const { data, error } = await supabase
    .from('webhook_logs')
    .insert({
      payload: payload,
      source: 'n8n',
      processed: false,
      created_at: new Date().toISOString()
    });
  
  if (error) {
    console.error('Erro ao salvar webhook log:', error);
    // Se a tabela não existe, apenas retorna sucesso
    return {
      message: 'Webhook recebido mas não armazenado (tabela webhook_logs não existe)',
      type: 'generic'
    };
  }
  
  return {
    message: 'Webhook genérico armazenado para análise',
    type: 'generic'
  };
}
