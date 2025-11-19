import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Executar disparos agendados
async function dispatchScheduledMessages(supabase: any) {
  console.log('🚀 Dispatcher: Iniciando execução...');
  
  const now = new Date();
  
  // Buscar mensagens agendadas para agora (com tolerância de 1 minuto)
  const toleranceStart = new Date(now.getTime() - 60000); // 1 minuto antes
  const toleranceEnd = new Date(now.getTime() + 60000); // 1 minuto depois
  
  const { data: messages, error: fetchError } = await supabase
    .from('scheduled_messages')
    .select('*')
    .eq('status', 'scheduled')
    .gte('scheduled_time', toleranceStart.toISOString())
    .lte('scheduled_time', toleranceEnd.toISOString())
    .limit(50); // Processar máximo 50 por execução
  
  if (fetchError) {
    console.error('❌ Erro ao buscar mensagens:', fetchError);
    throw fetchError;
  }
  
  if (!messages || messages.length === 0) {
    console.log('✅ Nenhuma mensagem pendente');
    return {
      success: true,
      processed: 0,
      sent: 0,
      failed: 0,
      message: 'Nenhuma mensagem pendente'
    };
  }
  
  console.log(`📨 ${messages.length} mensagens para processar`);
  
  let sent = 0;
  let failed = 0;
  
  // Processar mensagens em paralelo (lotes de 10)
  const BATCH_SIZE = 10;
  
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    
    await Promise.all(batch.map(async (msg) => {
      try {
        // Marcar como "executing"
        await supabase
          .from('scheduled_messages')
          .update({ status: 'executing' })
          .eq('id', msg.id);
        
        // Validar número de telefone
        if (!msg.phone_number || msg.phone_number.length < 10) {
          throw new Error('Número de telefone inválido');
        }
        
        // Enviar WhatsApp via whatsapp-service
        const sendResult = await sendWhatsAppMessage(supabase, msg);
        
        if (sendResult.success) {
          // Marcar como enviado
          await supabase
            .from('scheduled_messages')
            .update({ 
              status: 'sent',
              executed_at: now.toISOString()
            })
            .eq('id', msg.id);
          
          // Registrar interação
          await supabase
            .from('interactions')
            .insert({
              user_id: msg.user_id,
              lead_id: msg.lead_id,
              tipo: 'whatsapp',
              assunto: 'Mensagem agendada enviada',
              descricao: msg.message_content,
              data_interacao: now.toISOString()
            });
          
          sent++;
          console.log(`✅ Enviado: ${msg.metadata?.empresa || msg.phone_number}`);
        } else {
          throw new Error(sendResult.error || 'Erro ao enviar');
        }
        
      } catch (error) {
        console.error(`❌ Falha ao enviar para ${msg.phone_number}:`, error);
        
        // Verificar se deve retentar
        const shouldRetry = msg.retry_count < msg.max_retries;
        
        if (shouldRetry) {
          // Agendar nova tentativa em 5 minutos
          const retryTime = new Date(now.getTime() + 5 * 60000);
          
          await supabase
            .from('scheduled_messages')
            .update({ 
              status: 'retrying',
              retry_count: msg.retry_count + 1,
              scheduled_time: retryTime.toISOString(),
              error_message: error instanceof Error ? error.message : 'Erro desconhecido'
            })
            .eq('id', msg.id);
          
          console.log(`🔄 Retentativa agendada para ${retryTime.toISOString()}`);
        } else {
          // Máximo de retentativas atingido
          await supabase
            .from('scheduled_messages')
            .update({ 
              status: 'failed',
              executed_at: now.toISOString(),
              error_message: error instanceof Error ? error.message : 'Erro desconhecido'
            })
            .eq('id', msg.id);
        }
        
        failed++;
      }
    }));
    
    // Pequeno delay entre lotes
    if (i + BATCH_SIZE < messages.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Registrar execução
  await supabase
    .from('scheduler_logs')
    .insert({
      user_id: messages[0].user_id,
      campaign_id: messages[0].campaign_id,
      action: 'dispatch_executed',
      status: 'success',
      details: {
        execution_time: now.toISOString(),
        total_processed: messages.length,
        sent: sent,
        failed: failed
      }
    });
  
  console.log(`🎉 Dispatcher concluído: ${sent} enviados, ${failed} falhas`);
  
  return {
    success: true,
    processed: messages.length,
    sent: sent,
    failed: failed,
    timestamp: now.toISOString()
  };
}

// Enviar mensagem WhatsApp via whatsapp-service
async function sendWhatsAppMessage(supabase: any, message: any) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Buscar configurações do lead
    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('id', message.lead_id)
      .single();
    
    if (!lead) {
      throw new Error('Lead não encontrado');
    }
    
    // Gerar script personalizado
    const script = generateMessageScript(lead);
    
    // Enviar via whatsapp-service
    const response = await fetch(`${supabaseUrl}/functions/v1/whatsapp-service`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`
      },
      body: JSON.stringify({
        action: 'sendSingle',
        campaignId: message.campaign_id,
        userId: message.user_id,
        lead: lead
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WhatsApp service error: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    return result;
    
  } catch (error) {
    console.error('Erro ao enviar WhatsApp:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

// Gerar script de mensagem personalizado
function generateMessageScript(lead: any): string {
  const contato = lead.contato_decisor || lead.empresa;
  const empresa = lead.empresa || '[EMPRESA]';
  
  return `Bom dia, ${contato}. Falo da Infinity, escritório autorizado C6 Bank. Temos uma proposta para reduzir custos bancários da ${empresa} com conta PJ 100% gratuita, Pix ilimitado e 100 TEDs/boletos grátis. Posso enviar os detalhes?`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📡 Dispatcher triggered');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const result = await dispatchScheduledMessages(supabase);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro no message-dispatcher:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});