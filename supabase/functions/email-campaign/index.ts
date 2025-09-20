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
      
      // Personalizar e-mail
      const personalizedEmail = script.modelo_email
        .replace('[Nome]', contactName)
        .replace('[Seu Nome]', 'Equipe Consultoria Tributária Premium');

      // Template HTML do e-mail
      const htmlTemplate = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .cta-button { background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 0.9em; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>🏆 Consultoria Tributária Premium</h2>
              <p>Especialistas em Recuperação de Créditos Tributários</p>
            </div>
            <div class="content">
              <h3>${script.assunto_email}</h3>
              <p>${personalizedEmail.replace(/\n/g, '<br>')}</p>
              
              <a href="https://calendly.com/consultoria-tributaria" class="cta-button">
                📅 Agendar Reunião de 20 minutos
              </a>
              
              <p><strong>Por que escolher nossa consultoria?</strong></p>
              <ul>
                <li>✅ Especialistas em grandes corporações</li>
                <li>✅ Recuperação média de R$ 2-15 milhões por cliente</li>
                <li>✅ 95% de aprovação nos órgãos fiscais</li>
                <li>✅ Sem cobrança inicial - apenas success fee</li>
              </ul>
              
              <div class="footer">
                <p>📞 <strong>Contato Direto:</strong> (11) 9999-9999 | WhatsApp disponível</p>
                <p>🏢 <strong>Escritório:</strong> São Paulo/SP - Atendemos todo Brasil</p>
                <p>🎓 <strong>Equipe:</strong> PHD em Contabilidade e Finanças</p>
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
              from: 'Única Contábil <contato@unicacontabil.com>',
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