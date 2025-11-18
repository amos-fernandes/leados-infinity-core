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
    let qualifiedLeads: any[] = [];

    // FASE 1: QUALIFICAÇÃO IA COM ESFORÇO MÁXIMO
    console.log('🤖 FASE 1: Qualificação IA - Esforço Máximo para Decisores Financeiros');
    try {
      // Buscar leads não qualificados
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', userId)
        .or('status.is.null,status.eq.novo')
        .limit(50); // Processar em lotes

      if (leadsError) throw leadsError;

      console.log(`📊 ${leads?.length || 0} leads encontrados para qualificação`);

      let qualifiedCount = 0;
      let excludedCount = 0;

      for (const lead of leads || []) {
        // Qualificar cada lead com IA
        const { data: qualificationResult, error: qualError } = await supabase.functions.invoke('qualify-lead-with-ai', {
          body: {
            leadId: lead.id,
            userId,
            leadData: lead
          }
        });

        if (qualificationResult?.excluded) {
          excludedCount++;
          console.log(`❌ Lead ${lead.empresa} excluído: ${qualificationResult.reason}`);
        } else if (qualificationResult?.success) {
          qualifiedCount++;
          qualifiedLeads.push(lead);
          console.log(`✅ Lead ${lead.empresa} qualificado`);

          // Enriquecer contatos (WhatsApp + Partners)
          if (lead.cnpj) {
            try {
              await supabase.functions.invoke('enrich-contact-partners', {
                body: { cnpj: lead.cnpj, leadId: lead.id, userId }
              });
            } catch (enrichError) {
              console.error(`Erro ao enriquecer ${lead.empresa}:`, enrichError);
            }
          }
        }
      }

      campaignResults.push({
        phase: 1,
        name: 'Qualificação IA',
        status: 'completed',
        details: {
          totalLeads: leads?.length || 0,
          qualificados: qualifiedCount,
          excluidos: excludedCount,
          nota: 'Exclusão automática de MEI e contadores aplicada'
        }
      });

      console.log(`✅ Fase 1: ${qualifiedCount} leads qualificados, ${excludedCount} excluídos`);
    } catch (error) {
      campaignResults.push({
        phase: 1,
        name: 'Qualificação IA',
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

      // FASE 4: Acompanhamento CRM - Criar Oportunidades
      console.log('📊 FASE 4: Acompanhamento CRM - Criando Oportunidades');
      try {
        let oportunidadesCriadas = 0;

        // Criar oportunidade para cada lead qualificado
        for (const lead of qualifiedLeads) {
          const { error: oppError } = await supabase
            .from('opportunities')
            .insert({
              user_id: userId,
              empresa: lead.empresa,
              titulo: `Proposta Consultoria Tributária - ${lead.empresa}`,
              estagio: 'prospeccao',
              status: 'ativo',
              valor: lead.estimated_revenue ? parseFloat(lead.estimated_revenue.replace(/[^\d,]/g, '').replace(',', '.')) : null,
              probabilidade: lead.qualification_level === 'Alta' ? 70 : lead.qualification_level === 'Média' ? 40 : 20
            });

          if (!oppError) {
            oportunidadesCriadas++;
            
            // Registrar interação
            await supabase
              .from('interactions')
              .insert({
                user_id: userId,
                lead_id: lead.id,
                tipo: 'campanha',
                assunto: 'Campanha Automatizada Multi-canal',
                descricao: `Lead incluído em campanha automatizada. Canal recomendado: ${lead.recommended_channel || 'WhatsApp'}`,
                data_interacao: new Date().toISOString()
              });
          }
        }

        campaignResults.push({
          phase: 4,
          name: 'Acompanhamento CRM',
          status: 'completed',
          details: {
            oportunidades_criadas: oportunidadesCriadas,
            interacoes_registradas: oportunidadesCriadas,
            cronograma: ['24h - Verificar respostas', '72h - Follow-up'],
            autoTracking: true
          }
        });

        console.log(`✅ Fase 4: ${oportunidadesCriadas} oportunidades criadas no CRM`);
      } catch (error) {
        campaignResults.push({
          phase: 4,
          name: 'Acompanhamento CRM',
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
        name: 'Acompanhamento CRM',
        status: 'failed',
        details: { error: 'Campanha não foi criada - não é possível criar oportunidades' }
      });
    }

    // Resumo final
    const completedPhases = campaignResults.filter(p => p.status === 'completed').length;
    
    const finalMessage = campaignId ? 
      `✅ **Campanha Iniciada com Sucesso!**\n\n🎯 **Campanha ID: ${campaignId}**\n\n📊 **Fluxo de 4 Fases Completo:**\n- ✅ Fase 1: ${campaignResults[0]?.details?.qualificados || 0} leads qualificados (${campaignResults[0]?.details?.excluidos || 0} excluídos)\n- ✅ Fase 2: Campanha criada e configurada\n- 🔄 Fase 3: Processamento multi-canal em andamento\n- ✅ Fase 4: ${qualifiedLeads.length} oportunidades criadas no CRM\n\n**🚀 Premissa #1 Aplicada:**\n- ❌ MEI automaticamente excluído\n- ❌ Contadores automaticamente excluídos\n\n📊 Acompanhe o progresso na aba "Campanhas" e "CRM"\n\n⚡ O processamento continua em background.` :
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