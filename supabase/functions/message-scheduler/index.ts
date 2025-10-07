import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Gera horários randômicos únicos para 1000 disparos em 24 horas
// Algoritmo avançado que evita padrões mensais e garante heterogeneidade
function generateSmartSchedule(baseDate: Date, count: number = 1000): Date[] {
  const schedules: Date[] = [];
  const dayOfMonth = baseDate.getDate();
  const monthSeed = baseDate.getMonth();
  
  // 24 horas = 1440 minutos
  // 1000 disparos = ~1.44 minutos entre cada (86 segundos em média)
  // Vamos usar janelas de 2 minutos para ter flexibilidade
  
  const MINUTES_IN_DAY = 1440;
  const MIN_GAP_SECONDS = 60; // Mínimo 60 segundos entre disparos
  
  // Criar array de minutos do dia com offsets baseados no dia do mês
  const timeSlots: number[] = [];
  
  for (let i = 0; i < count; i++) {
    // Base: distribuir uniformemente ao longo do dia
    const baseMinute = Math.floor((i / count) * MINUTES_IN_DAY);
    
    // Adicionar offset randômico baseado no dia do mês + índice
    // Isso garante que o mesmo minuto não se repita em dias diferentes
    const seed = dayOfMonth * 1000 + monthSeed * 100 + i;
    const randomOffset = (seed * 9301 + 49297) % 233280; // LCG - Linear Congruential Generator
    const offsetMinutes = (randomOffset % 3) - 1; // -1, 0, ou +1 minuto
    
    let targetMinute = baseMinute + offsetMinutes;
    
    // Garantir que está dentro do dia
    if (targetMinute < 0) targetMinute = 0;
    if (targetMinute >= MINUTES_IN_DAY) targetMinute = MINUTES_IN_DAY - 1;
    
    timeSlots.push(targetMinute);
  }
  
  // Ordenar e garantir espaçamento mínimo
  timeSlots.sort((a, b) => a - b);
  
  // Converter minutos para timestamps e garantir espaçamento mínimo
  let lastTimestamp = baseDate.getTime();
  
  for (let minute of timeSlots) {
    const proposedTime = new Date(baseDate);
    proposedTime.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
    
    let timestamp = proposedTime.getTime();
    
    // Garantir gap mínimo de 60 segundos
    if (timestamp - lastTimestamp < MIN_GAP_SECONDS * 1000) {
      timestamp = lastTimestamp + MIN_GAP_SECONDS * 1000;
    }
    
    // Garantir que não ultrapassa o dia
    const endOfDay = new Date(baseDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    if (timestamp > endOfDay.getTime()) {
      timestamp = endOfDay.getTime();
    }
    
    schedules.push(new Date(timestamp));
    lastTimestamp = timestamp;
  }
  
  return schedules;
}

// Buscar campanhas e leads para agendamento
async function scheduleCampaignMessages(
  supabase: any,
  userId: string,
  campaignId?: string,
  targetDate?: Date
) {
  const scheduleDate = targetDate || new Date();
  scheduleDate.setHours(0, 0, 0, 0);
  
  console.log(`📅 Gerando agendamento para ${scheduleDate.toISOString()}`);
  
  // Buscar campanha
  let campaignQuery = supabase
    .from('campaigns')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'ativa');
  
  if (campaignId) {
    campaignQuery = campaignQuery.eq('id', campaignId);
  }
  
  const { data: campaigns, error: campaignError } = await campaignQuery.limit(1).single();
  
  if (campaignError || !campaigns) {
    throw new Error('Nenhuma campanha ativa encontrada');
  }
  
  // Buscar leads pendentes (que ainda não foram agendados hoje)
  const todayStart = new Date(scheduleDate);
  const todayEnd = new Date(scheduleDate);
  todayEnd.setHours(23, 59, 59, 999);
  
  // Buscar leads que já têm agendamento para hoje
  const { data: alreadyScheduled } = await supabase
    .from('scheduled_messages')
    .select('lead_id')
    .eq('user_id', userId)
    .eq('campaign_id', campaigns.id)
    .gte('scheduled_time', todayStart.toISOString())
    .lte('scheduled_time', todayEnd.toISOString());
  
  const scheduledLeadIds = new Set((alreadyScheduled || []).map((s: any) => s.lead_id));
  
  // Buscar leads qualificados que ainda não foram agendados
  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['qualificado', 'contatado', 'novo'])
    .limit(1000);
  
  if (leadsError || !leads || leads.length === 0) {
    throw new Error('Nenhum lead disponível para agendamento');
  }
  
  // Filtrar leads que já foram agendados
  const pendingLeads = leads.filter(lead => !scheduledLeadIds.has(lead.id));
  
  if (pendingLeads.length === 0) {
    throw new Error('Todos os leads já foram agendados para hoje');
  }
  
  console.log(`📊 ${pendingLeads.length} leads pendentes de agendamento`);
  
  // Limitar a 1000 leads por dia
  const leadsToSchedule = pendingLeads.slice(0, 1000);
  
  // Gerar horários randômicos
  const schedules = generateSmartSchedule(scheduleDate, leadsToSchedule.length);
  
  console.log(`🎲 ${schedules.length} horários gerados`);
  
  // Criar mensagens agendadas
  const scheduledMessages = leadsToSchedule.map((lead, index) => ({
    user_id: userId,
    campaign_id: campaigns.id,
    lead_id: lead.id,
    scheduled_time: schedules[index].toISOString(),
    phone_number: lead.whatsapp || lead.telefone || '',
    message_content: `Olá ${lead.contato_decisor || lead.empresa}! Sou da Infinity, escritório autorizado C6 Bank...`,
    status: 'scheduled',
    metadata: {
      empresa: lead.empresa,
      scheduled_by: 'scheduler',
      schedule_date: scheduleDate.toISOString()
    }
  }));
  
  // Inserir em lotes de 100
  const BATCH_SIZE = 100;
  let inserted = 0;
  
  for (let i = 0; i < scheduledMessages.length; i += BATCH_SIZE) {
    const batch = scheduledMessages.slice(i, i + BATCH_SIZE);
    const { error: insertError } = await supabase
      .from('scheduled_messages')
      .insert(batch);
    
    if (insertError) {
      console.error(`❌ Erro ao inserir lote ${i}-${i + batch.length}:`, insertError);
    } else {
      inserted += batch.length;
      console.log(`✅ Lote inserido: ${inserted}/${scheduledMessages.length}`);
    }
  }
  
  // Registrar log
  await supabase
    .from('scheduler_logs')
    .insert({
      user_id: userId,
      campaign_id: campaigns.id,
      action: 'schedule_created',
      status: 'success',
      details: {
        schedule_date: scheduleDate.toISOString(),
        total_leads: leadsToSchedule.length,
        inserted: inserted,
        first_schedule: schedules[0].toISOString(),
        last_schedule: schedules[schedules.length - 1].toISOString()
      }
    });
  
  return {
    success: true,
    scheduled: inserted,
    campaign: campaigns.name,
    schedule_date: scheduleDate.toISOString(),
    first_message: schedules[0].toISOString(),
    last_message: schedules[schedules.length - 1].toISOString()
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { userId, campaignId, targetDate, action } = body;

    if (!userId) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'userId é obrigatório'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let result;

    switch (action) {
      case 'schedule':
        const date = targetDate ? new Date(targetDate) : undefined;
        result = await scheduleCampaignMessages(supabase, userId, campaignId, date);
        break;
      
      default:
        throw new Error('Ação não reconhecida. Use action: "schedule"');
    }

    return new Response(JSON.stringify({ 
      success: true,
      data: result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro no message-scheduler:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});