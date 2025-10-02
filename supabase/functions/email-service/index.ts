import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import sgMail from "npm:@sendgrid/mail";

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

  // Enviar campanha de e-mail
  async sendCampaignEmails(campaignId: string, userId: string) {
    console.log('📧 EmailService: Iniciando campanha de e-mail via SendGrid');
    
    if (!this.sendgridApiKey) {
      console.warn('⚠️ SENDGRID_API_KEY não configurada, simulando envios');
      return this.simulateEmailCampaign(campaignId, userId);
    }

    try {
      // Buscar scripts da campanha
      const { data: scripts, error: scriptsError } = await this.supabase
        .from('campaign_scripts')
        .select('*, campaigns!inner(*)')
        .eq('campaign_id', campaignId)
        .eq('campaigns.user_id', userId);

      if (scriptsError) throw scriptsError;
      if (!scripts || scripts.length === 0) {
        throw new Error('Nenhum script encontrado para a campanha');
      }

      // Buscar leads correspondentes
      const empresas = scripts.map((s: any) => s.empresa);
      const { data: leads } = await this.supabase
        .from('leads')
        .select('*')
        .eq('user_id', userId)
        .in('empresa', empresas)
        .not('email', 'is', null);

      if (!leads || leads.length === 0) {
        console.warn('Nenhum lead com e-mail encontrado');
        return { sent: 0, errors: [], message: 'Nenhum lead com e-mail válido' };
      }

      console.log(`📨 Enviando e-mails para ${leads.length} leads`);

      const sent = [];
      const errors = [];

      // Enviar e-mails individualizados
      for (const lead of leads) {
        const script = scripts.find((s: any) => s.empresa === lead.empresa);
        if (!script || !lead.email) continue;

        try {
          const success = await this.sendEmail({
            to: lead.email,
            subject: script.assunto_email,
            html: this.formatEmailHTML(script.modelo_email, lead),
            leadName: lead.empresa
          });

          if (success) {
            sent.push(lead.empresa);
            
            // Marcar como enviado
            await this.supabase
              .from('campaign_scripts')
              .update({ email_enviado: true })
              .eq('id', script.id);

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
          console.error(`Erro ao enviar e-mail para ${lead.empresa}:`, error);
          errors.push({ empresa: lead.empresa, error: error instanceof Error ? error.message : 'Erro desconhecido' });
        }

        // Delay entre envios para evitar rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      return {
        sent: sent.length,
        errors,
        message: `${sent.length} e-mails enviados com sucesso`,
        details: sent
      };

    } catch (error) {
      console.error('❌ Erro na campanha de e-mail:', error);
      throw error;
    }
  }

  // Enviar e-mail individual via SendGrid
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

  // Formatar e-mail em HTML
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

  // Converter HTML para texto
  htmlToText(html: string) {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Simular campanha de e-mail (quando Resend não está configurado)
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
    const { campaignId, userId, channel } = body;

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