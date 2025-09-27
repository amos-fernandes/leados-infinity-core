import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Módulo de Agendamento seguindo a arquitetura proposta
class CampaignScheduler {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  // Verificar e executar campanhas agendadas
  async processScheduledCampaigns() {
    console.log('⏰ CampaignScheduler: Verificando campanhas agendadas');
    
    try {
      const now = new Date();
      
      // Buscar campanhas agendadas que devem ser executadas
      const { data: scheduledCampaigns, error } = await this.supabase
        .from('campaigns')
        .select('*')
        .eq('status', 'agendada')
        .lte('scheduled_at', now.toISOString());

      if (error) throw error;
      
      if (!scheduledCampaigns || scheduledCampaigns.length === 0) {
        return { processed: 0, message: 'Nenhuma campanha agendada para executar' };
      }

      console.log(`📅 Encontradas ${scheduledCampaigns.length} campanhas para executar`);

      const results = [];
      
      for (const campaign of scheduledCampaigns) {
        try {
          console.log(`🚀 Executando campanha agendada: ${campaign.name}`);
          
          // Atualizar status para 'executando'
          await this.supabase
            .from('campaigns')
            .update({ status: 'executando' })
            .eq('id', campaign.id);

          // Executar campanha via campaign-service
          const { data: result, error: execError } = await this.supabase.functions.invoke('campaign-service', {
            body: {
              action: 'run',
              campaignId: campaign.id,
              userId: campaign.user_id
            }
          });

          if (execError) {
            throw new Error(execError.message);
          }

          // Atualizar status baseado no resultado
          const finalStatus = result?.success ? 'finalizada' : 'erro';
          await this.supabase
            .from('campaigns')
            .update({ 
              status: finalStatus,
              executed_at: new Date().toISOString()
            })
            .eq('id', campaign.id);

          results.push({
            campaignId: campaign.id,
            name: campaign.name,
            status: finalStatus,
            result
          });

          console.log(`✅ Campanha ${campaign.name} executada com status: ${finalStatus}`);

        } catch (error) {
          console.error(`❌ Erro ao executar campanha ${campaign.id}:`, error);
          
          // Marcar campanha como erro
          await this.supabase
            .from('campaigns')
            .update({ 
              status: 'erro',
              error_message: error instanceof Error ? error.message : 'Erro desconhecido',
              executed_at: new Date().toISOString()
            })
            .eq('id', campaign.id);

          results.push({
            campaignId: campaign.id,
            name: campaign.name,
            status: 'erro',
            error: error instanceof Error ? error.message : 'Erro desconhecido'
          });
        }
      }

      return {
        processed: results.length,
        results,
        message: `${results.length} campanhas processadas`
      };

    } catch (error) {
      console.error('❌ Erro no processamento de campanhas agendadas:', error);
      throw error;
    }
  }

  // Agendar nova campanha
  async scheduleCampaign(campaignData: any) {
    console.log('📅 CampaignScheduler: Agendando nova campanha');
    
    try {
      const { userId, name, description, scheduledAt, targetCompanies } = campaignData;
      
      if (!scheduledAt) {
        throw new Error('Data de agendamento é obrigatória');
      }

      const scheduledDate = new Date(scheduledAt);
      const now = new Date();

      if (scheduledDate <= now) {
        throw new Error('Data de agendamento deve ser no futuro');
      }

      // Criar campanha com status 'agendada'
      const { data: campaign, error } = await this.supabase
        .from('campaigns')
        .insert({
          user_id: userId,
          name: name || `Campanha Agendada - ${scheduledDate.toLocaleDateString('pt-BR')}`,
          description: description || 'Campanha agendada automaticamente',
          status: 'agendada',
          scheduled_at: scheduledDate.toISOString(),
          target_companies: targetCompanies || []
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Campanha agendada para: ${scheduledDate.toLocaleString('pt-BR')}`);

      return {
        success: true,
        campaign,
        scheduledFor: scheduledDate.toISOString(),
        message: `Campanha agendada para ${scheduledDate.toLocaleString('pt-BR')}`
      };

    } catch (error) {
      console.error('❌ Erro ao agendar campanha:', error);
      throw error;
    }
  }

  // Executar follow-ups automáticos
  async processAutoFollowUps() {
    console.log('🔄 CampaignScheduler: Processando follow-ups automáticos');
    
    try {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

      // Buscar campanhas finalizadas nas últimas 24h para follow-up
      const { data: recentCampaigns } = await this.supabase
        .from('campaigns')
        .select('*')
        .eq('status', 'finalizada')
        .gte('executed_at', yesterday.toISOString())
        .lte('executed_at', now.toISOString());

      // Buscar campanhas de 3 dias atrás para follow-up final
      const { data: oldCampaigns } = await this.supabase
        .from('campaigns')
        .select('*')
        .eq('status', 'finalizada')
        .gte('executed_at', threeDaysAgo.toISOString())
        .lte('executed_at', new Date(threeDaysAgo.getTime() + 60 * 60 * 1000).toISOString()); // 1 hora de margem

      const followUps = [];

      // Follow-up 24h
      if (recentCampaigns && recentCampaigns.length > 0) {
        for (const campaign of recentCampaigns) {
          await this.createFollowUpInteractions(campaign, '24h');
          followUps.push({ campaignId: campaign.id, type: '24h' });
        }
      }

      // Follow-up 72h
      if (oldCampaigns && oldCampaigns.length > 0) {
        for (const campaign of oldCampaigns) {
          await this.createFollowUpInteractions(campaign, '72h');
          followUps.push({ campaignId: campaign.id, type: '72h' });
        }
      }

      return {
        processed: followUps.length,
        followUps,
        message: `${followUps.length} follow-ups automáticos processados`
      };

    } catch (error) {
      console.error('❌ Erro no processamento de follow-ups:', error);
      throw error;
    }
  }

  // Criar interações de follow-up
  async createFollowUpInteractions(campaign: any, type: string) {
    const followUpTasks = [];

    if (type === '24h') {
      followUpTasks.push({
        user_id: campaign.user_id,
        tipo: 'follow_up_24h',
        assunto: `Follow-up 24h - ${campaign.name}`,
        descricao: `Verificar respostas da campanha ${campaign.name}. Agendar demonstração para interessados. Priorizar WhatsApp.`,
        data_interacao: new Date().toISOString()
      });
    } else if (type === '72h') {
      followUpTasks.push({
        user_id: campaign.user_id,
        tipo: 'follow_up_72h',
        assunto: `Follow-up Final - ${campaign.name}`,
        descricao: `Follow-up final da campanha ${campaign.name}. Ligação para leads mornos. Finalizar oportunidades em aberto.`,
        data_interacao: new Date().toISOString()
      });
    }

    if (followUpTasks.length > 0) {
      await this.supabase
        .from('interactions')
        .insert(followUpTasks);
    }
  }

  // Limpar campanhas antigas
  async cleanupOldCampaigns() {
    console.log('🧹 CampaignScheduler: Limpando campanhas antigas');
    
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Arquivar campanhas finalizadas há mais de 30 dias
      const { data: oldCampaigns, error } = await this.supabase
        .from('campaigns')
        .update({ status: 'arquivada' })
        .eq('status', 'finalizada')
        .lt('executed_at', thirtyDaysAgo.toISOString())
        .select();

      if (error) throw error;

      return {
        archived: oldCampaigns?.length || 0,
        message: `${oldCampaigns?.length || 0} campanhas arquivadas`
      };

    } catch (error) {
      console.error('❌ Erro na limpeza de campanhas:', error);
      throw error;
    }
  }

  // Gerar relatório de performance
  async generatePerformanceReport(userId: string) {
    console.log('📊 CampaignScheduler: Gerando relatório de performance');
    
    try {
      const last30Days = new Date();
      last30Days.setDate(last30Days.getDate() - 30);

      // Buscar campanhas dos últimos 30 dias
      const { data: campaigns } = await this.supabase
        .from('campaigns')
        .select(`
          *,
          campaign_scripts(*),
          interactions(*)
        `)
        .eq('user_id', userId)
        .gte('created_at', last30Days.toISOString());

      if (!campaigns) return { campaigns: 0 };

      const stats = {
        totalCampaigns: campaigns.length,
        activeCampaigns: campaigns.filter((c: any) => c.status === 'ativa').length,
        completedCampaigns: campaigns.filter((c: any) => c.status === 'finalizada').length,
        totalScripts: campaigns.reduce((acc: number, c: any) => acc + (c.campaign_scripts?.length || 0), 0),
        totalInteractions: campaigns.reduce((acc: number, c: any) => acc + (c.interactions?.length || 0), 0),
        whatsappSent: campaigns.reduce((acc: number, c: any) => 
          acc + (c.campaign_scripts?.filter((s: any) => s.whatsapp_enviado)?.length || 0), 0),
        emailsSent: campaigns.reduce((acc: number, c: any) => 
          acc + (c.campaign_scripts?.filter((s: any) => s.email_enviado)?.length || 0), 0)
      };

      return stats;

    } catch (error) {
      console.error('❌ Erro ao gerar relatório:', error);
      throw error;
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, userId, campaignData } = body;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const scheduler = new CampaignScheduler(supabase);
    
    let result;

    switch (action) {
      case 'processScheduled':
        result = await scheduler.processScheduledCampaigns();
        break;
      case 'schedule':
        if (!userId || !campaignData) {
          throw new Error('userId e campaignData são obrigatórios para agendar');
        }
        result = await scheduler.scheduleCampaign({ ...campaignData, userId });
        break;
      case 'processFollowUps':
        result = await scheduler.processAutoFollowUps();
        break;
      case 'cleanup':
        result = await scheduler.cleanupOldCampaigns();
        break;
      case 'report':
        if (!userId) {
          throw new Error('userId é obrigatório para relatório');
        }
        result = await scheduler.generatePerformanceReport(userId);
        break;
      default:
        throw new Error('Ação não reconhecida');
    }

    return new Response(JSON.stringify({ 
      success: true,
      action,
      timestamp: new Date().toISOString(),
      ...result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro no CampaignScheduler:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});