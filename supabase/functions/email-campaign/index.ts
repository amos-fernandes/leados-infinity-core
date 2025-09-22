import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Email campaign function started');
    
    const body = await req.json();
    const { campaignId, userId } = body;
    
    console.log('Processing email campaign for:', { campaignId, userId });

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
    
    // Buscar roteiros da campanha
    const { data: scripts, error: scriptsError } = await supabase
      .from('campaign_scripts')
      .select('*')
      .eq('campaign_id', campaignId);

    if (scriptsError) {
      throw new Error(`Erro ao buscar roteiros: ${scriptsError.message}`);
    }

    console.log(`Found ${scripts?.length || 0} email scripts to process`);
    
    // Buscar leads relacionados às empresas da campanha
    const empresas = scripts?.map(s => s.empresa) || [];
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .eq('user_id', userId)
      .in('empresa', empresas);

    if (leadsError) {
      console.warn('Erro ao buscar leads:', leadsError);
    }

    const foundLeads = leads || [];
    console.log(`Found ${foundLeads.length} existing leads for email outreach`);

    // Preparar e-mails
    const emails = [];
    
    for (const script of scripts || []) {
      // Encontrar lead correspondente
      const relatedLead = foundLeads.find(lead => 
        lead.empresa.toLowerCase().includes(script.empresa.toLowerCase()) ||
        script.empresa.toLowerCase().includes(lead.empresa.toLowerCase())
      );

      const email = relatedLead?.email || `contato@${script.empresa.toLowerCase().replace(/\s+/g, '')}.com.br`;
      const contactName = relatedLead?.contato_decisor || 'Prezado(a) Responsável Financeiro';
      
      // Personalizar e-mail usando template C6 Bank
      const personalizedEmail = script.modelo_email
        .replace('[Nome]', contactName)
        .replace('[Nome do Consultor]', 'Equipe C6 Bank - Escritório Autorizado');

      // Template HTML do e-mail C6 Bank
      const htmlTemplate = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #FF6B00 0%, #FF8533 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .cta-button { background: #FF6B00; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 0.9em; color: #666; }
            .benefit-list { background: white; padding: 20px; border-radius: 5px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>🏦 C6 Bank - Conta PJ Digital</h2>
              <p>Escritório Autorizado - Abertura de Contas Empresariais</p>
            </div>
            <div class="content">
              <h3>${script.assunto_email}</h3>
              <p>${personalizedEmail.replace(/\n/g, '<br>')}</p>
              
              <div class="benefit-list">
                <h4>💡 Benefícios da Conta PJ C6 Bank:</h4>
                <ul>
                  <li>✅ <strong>Conta 100% gratuita</strong> - Zero mensalidade</li>
                  <li>✅ <strong>Pix ilimitado</strong> - Sem limite de transações</li>
                  <li>✅ <strong>100 TEDs gratuitos</strong> por mês</li>
                  <li>✅ <strong>100 boletos gratuitos</strong> por mês</li>
                  <li>✅ <strong>Crédito empresarial</strong> sujeito a análise</li>
                  <li>✅ <strong>Atendimento humano</strong> via escritório autorizado</li>
                </ul>
              </div>
              
              <a href="https://c6bank.com.br/conta-pj" class="cta-button">
                🚀 Abrir Conta Agora
              </a>
              
              <div class="footer">
                <p>📞 <strong>Contato Direto:</strong> (62) 98195-9829 | WhatsApp disponível</p>
                <p>🏢 <strong>Escritório Autorizado C6 Bank:</strong> Goiânia/GO</p>
                <p>🎯 <strong>Especialidade:</strong> Contas PJ para todos os tipos de empresa</p>
                <p><small>C6 Bank S.A. - Banco múltiplo autorizado pelo Banco Central do Brasil</small></p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      emails.push({
        to: email,
        subject: script.assunto_email,
        html: htmlTemplate,
        text: personalizedEmail,
        empresa: script.empresa
      });

      // Atualizar status do script
      await supabase
        .from('campaign_scripts')
        .update({ email_sent: true })
        .eq('id', script.id);
    }

    console.log('Email templates prepared:', emails.length);

    // Envio real de e-mails usando Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    if (resendApiKey) {
      for (const emailData of emails) {
        try {
          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: 'C6 Bank Escritório Autorizado <contato@c6bank-autorizado.com>',
              to: [emailData.to],
              subject: emailData.subject,
              html: emailData.html
            })
          });
          
          if (emailResponse.ok) {
            console.log(`Email sent to ${emailData.empresa}`);
          } else {
            console.error(`Failed to send email to ${emailData.empresa}: ${await emailResponse.text()}`);
          }
        } catch (error) {
          console.error(`Failed to send email to ${emailData.empresa}:`, error);
        }
      }
    } else {
      console.warn('RESEND_API_KEY not configured - emails not sent');
    }

    // Log da atividade para demonstração
    console.log('Email Campaign Summary:');
    emails.forEach(email => {
      console.log(`📧 ${email.empresa}: ${email.subject}`);
    });

    return new Response(JSON.stringify({ 
      success: true,
      message: `Email campaign preparada para ${emails.length} empresas`,
      sentCount: emails.length,
      emails: emails.map(e => ({ empresa: e.empresa, subject: e.subject, to: e.to }))
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in email-campaign function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message || 'Erro interno do servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});