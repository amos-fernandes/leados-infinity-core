import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

// Nova arquitetura centralizada - Fluxo automatizado completo
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Iniciando Fluxo de Campanha Automatizada - Nova Arquitetura');
    
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

    // FASE 1: Identificação/Captura de Leads (Google Maps)
    console.log('🔍 FASE 1: Captura de Leads via Google Maps');
    try {
      const { data: captureResult, error: captureError } = await supabase.functions.invoke('google-maps-scraper', {
        body: { 
          userId,
          searchQuery: 'empresas',
          location: 'Goiânia GO',
          maxResults: 25
        }
      });

      if (captureError) {
        throw new Error(`Erro na captura: ${captureError.message}`);
      }

      campaignResults.push({
        phase: 1,
        name: 'Captura de Leads (Google Maps)',
        status: captureResult?.success ? 'completed' : 'failed',
        details: {
          leadsCapturados: captureResult?.savedLeads || 0,
          totalEncontrados: captureResult?.totalFound || 0,
          fonte: 'Google Maps API',
          searchQuery: 'empresas',
          location: 'Goiânia GO'
        }
      });

      console.log(`✅ Fase 1: ${captureResult?.savedLeads || 0} leads capturados`);
    } catch (error) {
      campaignResults.push({
        phase: 1,
        name: 'Captura de Leads (Google Maps)',
        status: 'failed',
        details: { error: error instanceof Error ? error.message : 'Erro desconhecido' }
      });
    }

    // FASE 2: Criação da Campanha
    console.log('📊 FASE 2: Criação da Campanha');
    try {
      const { data: campaignResult, error: campaignError } = await supabase.functions.invoke('campaign-service', {
        body: {
          action: 'create',
          userId,
          campaignData: {
            userId, // Passar userId dentro de campaignData também
            name: `Campanha Automatizada - ${new Date().toLocaleDateString('pt-BR')}`,
            description: 'Campanha automatizada completa: Google Maps + Scripts IA + Multi-canal (WhatsApp + E-mail)'
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
          status: 'ativa'
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

    // FASE 3: Execução Multi-canal (se campanha foi criada)
    if (campaignId) {
      console.log('📱 FASE 3: Execução Multi-canal');
      try {
        const { data: executionResult, error: executionError } = await supabase.functions.invoke('campaign-service', {
          body: {
            action: 'run',
            campaignId,
            userId
          }
        });

        if (executionError) {
          throw new Error(`Erro na execução: ${executionError.message}`);
        }

        campaignResults.push({
          phase: 3,
          name: 'Execução Multi-canal',
          status: executionResult?.success ? 'completed' : 'failed',
          details: {
            whatsapp: executionResult?.results?.whatsapp || { status: 'not_executed' },
            email: executionResult?.results?.email || { status: 'not_executed' },
            scripts: executionResult?.results?.scripts || { status: 'not_executed' },
            interactions: executionResult?.results?.interactions || { status: 'not_executed' },
            totalLeads: executionResult?.totalLeads || 0
          }
        });

        console.log(`✅ Fase 3: Execução multi-canal concluída`);
      } catch (error) {
        campaignResults.push({
          phase: 3,
          name: 'Execução Multi-canal',
          status: 'failed',
          details: { error: error instanceof Error ? error.message : 'Erro desconhecido' }
        });
      }

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
    const failedPhases = campaignResults.filter(p => p.status === 'failed').length;
    
    const isSuccess = completedPhases >= 2; // Pelo menos captura + criação de campanha
    
    const finalMessage = isSuccess ? 
      `✅ **Campanha Automatizada Executada!**\n\n🎯 **${completedPhases}/4 fases concluídas com sucesso**\n\n📊 **Resumo:**\n- ${campaignResults[0]?.details?.leadsCapturados || 0} leads capturados\n- Campanha criada: ${campaignId ? 'Sim' : 'Não'}\n- Multi-canal executado: ${campaignResults[2]?.status === 'completed' ? 'Sim' : 'Não'}\n- Follow-ups agendados: ${campaignResults[3]?.status === 'completed' ? 'Sim' : 'Não'}\n\n🚀 **Próximos passos automáticos:**\n- Monitoramento de respostas\n- Follow-up 24h e 72h\n- Relatórios de performance\n\nVerifique os resultados nas abas de Campanhas e CRM!` :
      `⚠️ **Campanha Parcialmente Executada**\n\n📊 **${completedPhases}/4 fases concluídas**\n${failedPhases} fases falharam\n\nVerifique os logs para mais detalhes.`;

    return new Response(JSON.stringify({ 
      success: isSuccess,
      message: finalMessage,
      campaignId,
      phases: campaignResults,
      summary: {
        totalPhases: 4,
        completedPhases,
        failedPhases,
        successRate: `${Math.round((completedPhases / 4) * 100)}%`
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