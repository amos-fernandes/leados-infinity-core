import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import sgMail from "npm:@sendgrid/mail";
import { compareTwoStrings } from "npm:string-similarity@4.0.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configurar SendGrid API Key
sgMail.setApiKey(Deno.env.get('SENDGRID_API_KEY') as string);

// Módulo de E-mail seguindo a arquitetura proposta
class EmailService {
  private supabase: any;
  private sendgridApiKey: string | undefined;

  constructor(supabase: any) {
    this.supabase = supabase;
    this.sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');
  }

  // Normalizar nome de empresa para correspondência
  private normalizeCompanyName(name: string): string {
    if (!name) return '';
    return name
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/\s+(ltda|me|eireli|epp|sa|s\.a\.|s\/a|e cia|do brasil|brasil)(\s|$)/gi, ' ')
      .replace(/[^\\w\\s]/g, '') // Remove pontuação
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Fuzzy match entre dois nomes de empresa
  private fuzzyMatch(str1: string, str2: string): number {
    const normalized1 = this.normalizeCompanyName(str1);
    const normalized2 = this.normalizeCompanyName(str2);
    return compareTwoStrings(normalized1, normalized2);
  }

  // Encontrar lead correspondente usando múltiplos critérios
  private findMatchingLead(script: any, leads: any[]): { lead: any; matchReason: string; similarity: number } | null {
    // Prioridade 1: Match exato por empresa + telefone
    for (const lead of leads) {
      const empresaNormalizada = this.normalizeCompanyName(lead.empresa || '');
      const scriptEmpresaNormalizada = this.normalizeCompanyName(script.empresa || '');
      
      if (empresaNormalizada && scriptEmpresaNormalizada === empresaNormalizada && 
          lead.telefone && script.empresa && lead.telefone.includes(lead.telefone?.slice(-8))) {
        return { lead, matchReason: 'Empresa + Telefone (exato)', similarity: 1.0 };
      }
    }

    // Prioridade 2: Match exato por empresa + email domain
    for (const lead of leads) {
      const empresaNormalizada = this.normalizeCompanyName(lead.empresa || '');
      const scriptEmpresaNormalizada = this.normalizeCompanyName(script.empresa || '');
      
      if (empresaNormalizada && scriptEmpresaNormalizada === empresaNormalizada && 
          lead.email && lead.site_url) {
        const emailDomain = lead.email.split('@')[1];
        const siteDomain = lead.site_url?.replace(/^https?:\/\//i, '').split('/')[0];
        if (emailDomain === siteDomain) {
          return { lead, matchReason: 'Empresa + Email Domain (exato)', similarity: 1.0 };
        }
      }
    }

    // Prioridade 3: Fuzzy match por empresa (similaridade >= 0.8)
    let bestMatch: { lead: any; matchReason: string; similarity: number } | null = null;
    let bestSimilarity = 0;

    for (const lead of leads) {
      const similarity = this.fuzzyMatch(lead.empresa || '', script.empresa || '');
      if (similarity >= 0.8 && similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = { 
          lead, 
          matchReason: `Empresa (fuzzy ${(similarity * 100).toFixed(0)}%)`, 
          similarity 
        };
      }
    }

    if (bestMatch) return bestMatch;

    // Prioridade 4: Match por telefone apenas (se disponível)
    if (script.telefone) {
      for (const lead of leads) {
        if (lead.telefone && lead.telefone.includes(script.telefone.slice(-8))) {
          return { lead, matchReason: 'Telefone (fallback)', similarity: 0.7 };
        }
      }
    }

    return null;
  }

  // Registrar erro de campanha no banco
  private async logCampaignError(campaignId: string, leadId: string | null, errorType: string, errorMessage: string, metadata: any = {}) {
    try {
      await this.supabase.from('campaign_errors').insert({
        campaign_id: campaignId,
        lead_id: leadId,
        error_type: errorType,
        error_message: errorMessage,
        metadata,
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.error('⚠️ Erro ao registrar erro de campanha:', err);
    }
  }

  // Enviar campanha de e-mails
  async sendCampaignEmails(campaignId: string, userId: string) {
    console.log(`📧 === INICIANDO ENVIO DE E-MAILS PARA CAMPANHA ${campaignId} ===`);
    console.log(`📊 userId: ${userId}`);
    
    const sent = [];
    const errors = [];

    if (!this.sendgridApiKey) {
      console.warn('⚠️ SENDGRID_API_KEY não configurada, simulando envios');
      return this.simulateEmailCampaign(campaignId, userId);
    }

    try {
      // Buscar scripts da campanha
      console.log('📧 Buscando scripts da campanha...');
      const { data: scripts, error: scriptsError } = await this.supabase
        .from('campaign_scripts')
        .select('*')
        .eq('campaign_id', campaignId);

      if (scriptsError) throw scriptsError;

      // Buscar todos os leads do usuário
      const { data: leads, error: leadsError } = await this.supabase
        .from('leads')
        .select('*')
        .eq('user_id', userId)
        .not('email', 'is', null);

      if (leadsError) throw leadsError;

      console.log(`📧 Scripts encontrados: ${scripts.length}`);
      console.log(`📧 Leads encontrados: ${leads.length}`);

      if (scripts.length === 0) {
        console.log('⚠️ Nenhum script encontrado para esta campanha');
        await this.logCampaignError(campaignId, null, 'NO_SCRIPTS', 'Nenhum script encontrado para esta campanha');
        return { sent, errors: [{ error: 'Nenhum script encontrado' }] };
      }

      if (leads.length === 0) {
        console.log('⚠️ Nenhum lead encontrado para enviar e-mails');
        await this.logCampaignError(campaignId, null, 'NO_LEADS', 'Nenhum lead encontrado para enviar e-mails');
        return { sent, errors: [{ error: 'Nenhum lead encontrado' }] };
      }

      // Estatísticas de correspondência
      const matchStats = {
        exactMatch: 0,
        fuzzyMatch: 0,
        phoneMatch: 0,
        noMatch: 0
      };

      // Para cada script, encontrar o lead correspondente e enviar
      console.log('📧 Iniciando correspondência de scripts com leads...');
      
      for (const script of scripts) {
        try {
          console.log(`\n📧 Processando script para: ${script.empresa}`);
          
          // Encontrar lead correspondente usando fuzzy matching
          const matchResult = this.findMatchingLead(script, leads);
          
          if (!matchResult) {
            console.log(`❌ Nenhum lead correspondente encontrado para: ${script.empresa}`);
            matchStats.noMatch++;
            await this.logCampaignError(
              campaignId, 
              null, 
              'NO_MATCH', 
              `Nenhum lead correspondente encontrado`,
              { scriptEmpresa: script.empresa }
            );
            errors.push({ 
              script: script.empresa, 
              error: 'Nenhum lead correspondente encontrado' 
            });
            continue;
          }

          const { lead, matchReason, similarity } = matchResult;
          console.log(`✅ Match encontrado: Lead "${lead.empresa}" <-> Script "${script.empresa}" (${matchReason}, similaridade: ${(similarity * 100).toFixed(0)}%)`);
          
          // Atualizar estatísticas
          if (similarity === 1.0) {
            matchStats.exactMatch++;
          } else if (similarity >= 0.8) {
            matchStats.fuzzyMatch++;
          } else {
            matchStats.phoneMatch++;
          }

          if (!lead.email) {
            console.log(`⚠️ Lead ${lead.empresa} não possui e-mail cadastrado`);
            await this.logCampaignError(
              campaignId, 
              lead.id, 
              'NO_EMAIL', 
              'Lead não possui e-mail cadastrado',
              { leadEmpresa: lead.empresa, matchReason }
            );
            errors.push({ lead: lead.empresa, error: 'E-mail não cadastrado' });
            continue;
          }

          if (!script.assunto_email || !script.modelo_email) {
            console.log(`⚠️ Script para ${lead.empresa} está incompleto (falta assunto ou modelo)`);
            await this.logCampaignError(
              campaignId, 
              lead.id, 
              'INCOMPLETE_SCRIPT', 
              'Script não possui assunto ou modelo de e-mail',
              { leadEmpresa: lead.empresa, scriptId: script.id }
            );
            errors.push({ lead: lead.empresa, error: 'Script incompleto' });
            continue;
          }

          console.log(`📧 Enviando e-mail para: ${lead.empresa} (${lead.email})`);
          
          const success = await this.sendEmail({
            to: lead.email,
            subject: script.assunto_email,
            html: this.formatEmailHTML(script.modelo_email, lead),
            leadName: lead.empresa
          });

          if (success) {
            sent.push(lead.empresa);
            console.log(`✅ E-mail enviado com sucesso para ${lead.empresa}`);
            
            // Registrar interação
            await this.supabase
              .from('interactions')
              .insert({
                user_id: userId,
                lead_id: lead.id,
                tipo: 'email',
                assunto: script.assunto_email,
                descricao: `E-mail enviado: ${script.assunto_email}`,
                data_interacao: new Date().toISOString()
              });
          }
        } catch (error) {
          console.error(`❌ Erro ao processar script para ${script.empresa}:`, error);
          await this.logCampaignError(
            campaignId, 
            null, 
            'PROCESSING_ERROR', 
            error instanceof Error ? error.message : 'Erro desconhecido',
            { scriptEmpresa: script.empresa }
          );
          errors.push({ script: script.empresa, error: error instanceof Error ? error.message : 'Erro desconhecido' });
        }

        // Delay entre envios
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`\n📧 === RESUMO DO ENVIO DE E-MAILS ===`);
      console.log(`✅ Enviados com sucesso: ${sent.length}`);
      console.log(`❌ Erros: ${errors.length}`);
      console.log(`📊 Estatísticas de Correspondência:`);
      console.log(`   - Match Exato: ${matchStats.exactMatch}`);
      console.log(`   - Fuzzy Match: ${matchStats.fuzzyMatch}`);
      console.log(`   - Match por Telefone: ${matchStats.phoneMatch}`);
      console.log(`   - Sem Correspondência: ${matchStats.noMatch}`);
      console.log(`📧 === FIM DO ENVIO DE E-MAILS ===\n`);

      return { sent: sent.length, errors, matchStats };

    } catch (error) {
      console.error('❌ Erro na campanha de e-mail:', error);
      throw error;
    }
  }

  async sendEmail({ to, subject, html, leadName }: any) {
    try {
      const msg = {
        to: to,
        from: {
          email: 'contato@infinity-leads.com',
          name: 'Escritório Infinity'
        },
        subject: subject,
        html: html,
        text: this.htmlToText(html)
      };

      const result = await sgMail.send(msg);
      console.log(`✅ E-mail enviado via SendGrid para ${leadName}`);
      return true;

    } catch (error: any) {
      console.error(`❌ Falha ao enviar e-mail via SendGrid para ${leadName}:`, error);
      if (error.response) {
        console.error('SendGrid Error Details:', error.response.body);
      }
      throw error;
    }
  }

  formatEmailHTML(template: string, lead: any) {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Proposta Conta PJ C6 Bank</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
            .content { background: #f8f9fa; padding: 30px 20px; }
            .benefits { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .benefit-item { display: flex; align-items: center; margin: 10px 0; }
            .benefit-icon { color: #28a745; margin-right: 10px; font-weight: bold; }
            .cta { background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
            .footer { text-align: center; color: #666; font-size: 14px; padding: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🏦 Conta PJ C6 Bank</h1>
                <p>Escritório Autorizado Infinity</p>
            </div>
            
            <div class="content">
                <div style="white-space: pre-line; margin-bottom: 20px;">
                    ${template}
                </div>
                
                <div class="benefits">
                    <h3>✅ Benefícios Exclusivos:</h3>
                    <div class="benefit-item">
                        <span class="benefit-icon">✅</span>
                        <span>Conta 100% gratuita - Zero mensalidade</span>
                    </div>
                    <div class="benefit-item">
                        <span class="benefit-icon">✅</span>
                        <span>Pix ilimitado sem custo</span>
                    </div>
                    <div class="benefit-item">
                        <span class="benefit-icon">✅</span>
                        <span>100 TEDs gratuitos mensais</span>
                    </div>
                    <div class="benefit-item">
                        <span class="benefit-icon">✅</span>
                        <span>100 boletos gratuitos mensais</span>
                    </div>
                    <div class="benefit-item">
                        <span class="benefit-icon">✅</span>
                        <span>Acesso a crédito sujeito a análise</span>
                    </div>
                    <div class="benefit-item">
                        <span class="benefit-icon">✅</span>
                        <span>Atendimento humano especializado</span>
                    </div>
                </div>
                
                <div style="text-align: center;">
                    <a href="https://wa.me/5562991792303?text=Tenho%20interesse%20na%20conta%20PJ%20C6%20Bank%20para%20${encodeURIComponent(lead.empresa || 'minha empresa')}" class="cta">
                        💬 Responder via WhatsApp
                    </a>
                </div>
            </div>
            
            <div class="footer">
                <p><strong>Escritório Infinity - C6 Bank PJ</strong></p>
                <p>📞 (62) 99179-2303 | 📧 contato@infinity-leads.com</p>
                <p>Escritório autorizado para abertura de contas PJ C6 Bank</p>
            </div>
        </div>
    </body>
    </html>
    `;
    
    return html;
  }

  htmlToText(html: string) {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async simulateEmailCampaign(campaignId: string, userId: string) {
    console.log('🎭 Simulando campanha de e-mail');
    
    const { data: scripts } = await this.supabase
      .from('campaign_scripts')
      .select('*')
      .eq('campaign_id', campaignId);

    if (!scripts) return { sent: 0, message: 'Nenhum script encontrado' };

    // Marcar como enviado (simulação)
    await this.supabase
      .from('campaign_scripts')
      .update({ email_enviado: true })
      .eq('campaign_id', campaignId);

    // Criar interações simuladas
    const interactions = scripts.map((script: any) => ({
      user_id: userId,
      tipo: 'email_simulado',
      assunto: script.assunto_email,
      descricao: `[SIMULADO] E-mail enviado para ${script.empresa}: ${script.assunto_email}`,
      data_interacao: new Date().toISOString()
    }));

    await this.supabase
      .from('interactions')
      .insert(interactions);

    return {
      sent: scripts.length,
      message: `${scripts.length} e-mails simulados (configure SENDGRID_API_KEY para envios reais)`,
      simulated: true
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { campaignId, userId } = body;

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

    const emailService = new EmailService(supabase);
    const result = await emailService.sendCampaignEmails(campaignId, userId);

    return new Response(JSON.stringify({ 
      success: true,
      ...result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro no EmailService:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
