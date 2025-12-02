import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

// Secure webhook secret validation
function validateWebhookSecret(req: Request): boolean {
  const webhookSecret = Deno.env.get('LEADOS_WEBHOOK_SECRET');
  
  // If no secret is configured, allow access (backward compatibility)
  // IMPORTANT: Configure LEADOS_WEBHOOK_SECRET in production!
  if (!webhookSecret) {
    console.warn('⚠️ LEADOS_WEBHOOK_SECRET not configured - webhook is unprotected');
    return true;
  }
  
  const providedSecret = req.headers.get('x-webhook-secret') || 
                         req.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!providedSecret) {
    console.error('❌ No webhook secret provided');
    return false;
  }
  
  // Constant-time comparison to prevent timing attacks
  if (providedSecret.length !== webhookSecret.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < providedSecret.length; i++) {
    result |= providedSecret.charCodeAt(i) ^ webhookSecret.charCodeAt(i);
  }
  
  return result === 0;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate webhook secret
  if (!validateWebhookSecret(req)) {
    console.error('❌ Unauthorized webhook request');
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Unauthorized - invalid or missing webhook secret' 
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const payload = await req.json();
    
    console.log('📨 Webhook LEADOS recebido (authenticated):', {
      method: req.method,
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
      case 'create_contact':
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
      
      case 'create_opportunity':
        result = await processCreateOpportunity(supabase, payload);
        break;
      
      case 'create_appointment':
      case 'create_meeting':
        result = await processCreateAppointment(supabase, payload);
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
        error: error.message
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
  
  // Validate user_id is provided
  const userId = payload.userId || payload.user_id;
  if (!userId) {
    throw new Error('userId is required for lead collection');
  }
  
  for (const lead of leads) {
    try {
      // Insere no CRM (tabela contacts)
      const { data, error } = await supabase
        .from('contacts')
        .upsert({
          user_id: userId,
          nome: lead.company_name || lead.name || lead.nome,
          empresa: lead.company_name || lead.empresa,
          email: lead.email,
          telefone: lead.phone || lead.telefone,
          status: 'ativo',
          created_at: new Date().toISOString()
        }, { onConflict: 'id' });
      
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
  
  if (!leadId) {
    throw new Error('leadId is required for lead qualification');
  }
  
  const { data, error } = await supabase
    .from('contacts')
    .update({
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
  
  const userId = payload.userId || payload.user_id;
  if (!userId) {
    throw new Error('userId is required for campaign dispatch');
  }
  
  const campaignData = {
    user_id: userId,
    name: payload.campaignName || 'Campanha n8n',
    status: payload.status || 'active',
    type: payload.campaignType || 'whatsapp',
    results: payload.results || {},
    created_at: new Date().toISOString()
  };
  
  const { data, error } = await supabase
    .from('interactions')
    .insert({
      user_id: userId,
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
  
  const contactId = payload.contactId || payload.contact_id;
  const enrichedData = payload.data || payload.enrichment || {};
  
  if (!contactId) {
    throw new Error('contactId is required for data enrichment');
  }
  
  // Only allow specific fields to be updated
  const allowedFields = ['empresa', 'cargo', 'telefone', 'linkedin', 'website', 'observacoes'];
  const safeData: Record<string, any> = {};
  
  for (const field of allowedFields) {
    if (enrichedData[field] !== undefined) {
      safeData[field] = enrichedData[field];
    }
  }
  
  safeData.updated_at = new Date().toISOString();
  
  const { data, error } = await supabase
    .from('contacts')
    .update(safeData)
    .eq('id', contactId);
  
  if (error) throw error;
  
  return {
    contactId,
    fieldsUpdated: Object.keys(safeData).length - 1,
    type: 'data_enrichment'
  };
}

async function processCreateOpportunity(supabase: any, payload: any) {
  console.log('💼 Processando criação de oportunidade...');
  
  const userId = payload.userId || payload.user_id;
  if (!userId) {
    throw new Error('userId is required for create_opportunity');
  }
  
  const opportunityData = {
    user_id: userId,
    empresa: payload.empresa || payload.company || 'Não informado',
    titulo: payload.titulo || payload.title || 'Oportunidade via n8n',
    valor: payload.valor || payload.value || null,
    estagio: payload.estagio || payload.stage || 'prospeccao',
    status: payload.status || 'aberta',
    probabilidade: payload.probabilidade || payload.probability || null,
    data_fechamento_esperada: payload.data_fechamento_esperada || payload.expected_close_date || null,
    observacoes: payload.observacoes || payload.notes || null,
    contato_id: payload.contato_id || payload.contact_id || null,
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('opportunities')
    .insert(opportunityData)
    .select()
    .single();
  
  if (error) {
    console.error('Erro ao criar oportunidade:', error);
    throw error;
  }
  
  console.log('✅ Oportunidade criada:', data);
  
  return {
    opportunity: data,
    type: 'create_opportunity'
  };
}

async function processCreateAppointment(supabase: any, payload: any) {
  console.log('📅 Processando criação de agendamento...');
  
  const userId = payload.userId || payload.user_id;
  if (!userId) {
    throw new Error('userId is required for create_appointment');
  }
  
  // Criar interação do tipo agendamento
  const appointmentData = {
    user_id: userId,
    tipo: 'reuniao',
    assunto: payload.assunto || payload.subject || 'Reunião agendada via n8n',
    descricao: payload.descricao || payload.description || null,
    data_interacao: payload.data_agendamento || payload.scheduled_date || new Date().toISOString(),
    contact_id: payload.contato_id || payload.contact_id || null,
    lead_id: payload.lead_id || null,
    opportunity_id: payload.opportunity_id || null,
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('interactions')
    .insert(appointmentData)
    .select()
    .single();
  
  if (error) {
    console.error('Erro ao criar agendamento:', error);
    throw error;
  }
  
  console.log('✅ Agendamento criado:', data);
  
  return {
    appointment: data,
    type: 'create_appointment'
  };
}

async function processGenericWebhook(supabase: any, payload: any) {
  console.log('📦 Processando webhook genérico...');
  
  // Just log and return - don't store in webhook_logs without proper user context
  return {
    message: 'Webhook genérico recebido',
    type: 'generic'
  };
}
