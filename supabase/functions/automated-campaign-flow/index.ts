import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CampaignPhase {
  phase: number;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  details: any;
}

// Nova arquitetura centralizada - Fluxo automatizado completo com processamento em background
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Iniciando Fluxo de Campanha Automatizada - Processamento em Background');
    
    const body = await req.json();
    const { userId } = body;
    
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

    const campaignResults: CampaignPhase[] = [];
    let campaignId: string | null = null;

    // FASE 1: Identificação/Captura de Leads (Google Maps) - OPCIONAL
    console.log('🔍 FASE 1: Captura de Leads via Google Maps (PULADA - Usar leads existentes)');
    campaignResults.push({
      phase: 1,
      name: 'Captura de Leads (Google Maps)',
      status: 'completed',
      details: {
        leadsCapturados: 0,
        nota: 'Usando leads já importados na base'
      }
    });

    // FASE 2: Criação da Campanha
    console.log('📊 FASE 2: Criação da Campanha');
    try {
      const { data: campaignResult, error: campaignError } = await supabase.functions.invoke('campaign-service', {
        body: {
          action: 'create',
          userId,
          campaignData: {
            userId,
            name: `Campanha Automatizada - ${new Date().toLocaleDateString('pt-BR')}`,
            description: 'Campanha automatizada: Processando leads em background (Multi-canal: WhatsApp + E-mail)'
          }
        }
      });

      if (campaignError) {
        throw new Error(`Erro ao criar campanha: ${campaignError.message}`);
      }

      campaignId = campaignResult?.data?.id;

      campaignResults.push({
        phase: 2,
        name: 'Criação da Campanha',
        status: 'completed',
        details: {
          campaignId,
          campaignName: campaignResult?.data?.name,
          status: 'em_execucao'
        }
      });

      console.log(`✅ Fase 2: Campanha criada com ID: ${campaignId}`);
    } catch (error) {
      campaignResults.push({
        phase: 2,
        name: 'Criação da Campanha',
        status: 'failed',
        details: { error: error instanceof Error ? error.message : 'Erro desconhecido' }
      });
    }

    // FASE 3: Execução Multi-canal EM BACKGROUND (se campanha foi criada)
    if (campaignId) {
      console.log('📱 FASE 3: Iniciando Execução Multi-canal em BACKGROUND');
      
      // Iniciar processamento em background (NÃO AGUARDAR)
      const backgroundExecution = (async () => {
        try {
          const { data: executionResult, error: executionError } = await supabase.functions.invoke('campaign-service', {
            body: {
              action: 'run',
              campaignId,
              userId
            }
          });

          if (executionError) {
            console.error('❌ Erro na execução background:', executionError);
          } else {
            console.log('✅ Execução background iniciada com sucesso:', executionResult);
          }
        } catch (error) {
          console.error('❌ Erro crítico na execução background:', error);
        }
      })();

      // Usar waitUntil para não bloquear a resposta
      if (typeof (globalThis as any).EdgeRuntime !== 'undefined') {
        (globalThis as any).EdgeRuntime.waitUntil(backgroundExecution);
      }

      campaignResults.push({
        phase: 3,
        name: 'Execução Multi-canal',
        status: 'completed',
        details: {
          nota: 'Processamento iniciado em background',
          status: 'Acompanhe o progresso na aba Campanhas',
          whatsapp: { status: 'processando' },
          email: { status: 'processando' }
        }
      });

      console.log(`✅ Fase 3: Execução multi-canal iniciada em background`);

      // FASE 4: Agendamento de Follow-ups
      console.log('📅 FASE 4: Agendamento de Follow-ups');
      try {
        const { data: followUpResult, error: followUpError } = await supabase.functions.invoke('campaign-scheduler', {
          body: {
            action: 'processFollowUps',
            userId
          }
        });

        if (followUpError) {
          throw new Error(`Erro no agendamento: ${followUpError.message}`);
        }

        campaignResults.push({
          phase: 4,
          name: 'Agendamento de Follow-ups',
          status: 'completed',
          details: {
            followUpsAgendados: followUpResult?.followUps || 0,
            cronograma: ['24h - Verificar respostas', '72h - Ligação final'],
            autoFollowUp: true
          }
        });

        console.log(`✅ Fase 4: Follow-ups agendados`);
      } catch (error) {
        campaignResults.push({
          phase: 4,
          name: 'Agendamento de Follow-ups',
          status: 'failed',
          details: { error: error instanceof Error ? error.message : 'Erro desconhecido' }
        });
      }
    } else {
      // Se não foi possível criar campanha, pular fases 3 e 4
      campaignResults.push({
        phase: 3,
        name: 'Execução Multi-canal',
        status: 'failed',
        details: { error: 'Campanha não foi criada - não é possível executar' }
      });

      campaignResults.push({
        phase: 4,
        name: 'Agendamento de Follow-ups',
        status: 'failed',
        details: { error: 'Campanha não foi criada - não é possível agendar follow-ups' }
      });
    }

    // Resumo final
    const completedPhases = campaignResults.filter(p => p.status === 'completed').length;
    
    const finalMessage = campaignId ? 
      `✅ **Campanha Iniciada com Sucesso!**\n\n🎯 **Campanha ID: ${campaignId}**\n\n📊 **Status:**\n- ✅ Campanha criada e configurada\n- 🔄 Processamento em andamento (background)\n- 📧 WhatsApp e E-mail sendo enviados\n- ⏰ Follow-ups agendados\n\n**🚀 A campanha está processando TODOS os leads da sua base!**\n\n📊 Acompanhe o progresso em tempo real na aba "Campanhas"\n\n⚡ O processamento continua mesmo se você fechar esta tela.` :
      `⚠️ **Erro ao criar campanha**\n\nVerifique os logs para mais detalhes.`;

    return new Response(JSON.stringify({ 
      success: !!campaignId,
      message: finalMessage,
      campaignId,
      phases: campaignResults,
      summary: {
        totalPhases: 4,
        completedPhases,
        status: campaignId ? 'em_execucao' : 'erro',
        nota: 'Processamento em background - acompanhe na aba Campanhas'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro crítico no fluxo automatizado:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno do servidor',
      message: '❌ Falha crítica no fluxo automatizado. Verifique os logs para mais detalhes.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});