import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface OnboardingEmailRequest {
  user_id: string;
  email: string;
  name: string;
  day: number; // 1, 3, 5, 7
  plan: 'trial' | 'free';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { user_id, email, name, day, plan }: OnboardingEmailRequest = await req.json();

    if (!user_id || !email || !name || !day) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let subject = "";
    let htmlContent = "";

    switch (day) {
      case 1:
        subject = `Bem-vindo(a) ao Leados AI, ${name}!`;
        htmlContent = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">Bem-vindo ao Leados AI!</h1>
            </div>
            
            <div style="padding: 40px 20px;">
              <p style="font-size: 16px; line-height: 1.6; color: #374151;">Olá ${name},</p>
              
              <p style="font-size: 16px; line-height: 1.6; color: #374151;">
                Sou o fundador do Leados AI e estou animado para ter você a bordo! 
                Nossa plataforma já ajudou mais de 1.500 empresas a revolucionar sua prospecção B2B.
              </p>
              
              <p style="font-size: 16px; line-height: 1.6; color: #374151;">
                Para começar, aqui está um guia rápido para sua primeira busca de leads em 3 minutos:
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${Deno.env.get("SUPABASE_URL")}" 
                   style="background: #3b82f6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                  Começar Agora
                </a>
              </div>
              
              <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #1f2937; margin-top: 0;">🎯 Sua primeira busca:</h3>
                <ol style="color: #374151;">
                  <li>Acesse o dashboard</li>
                  <li>Clique em "Criar Leads"</li>
                  <li>Digite o setor da sua empresa alvo</li>
                  <li>Configure os filtros</li>
                  <li>Clique em "Gerar Leads"</li>
                </ol>
              </div>
              
              <p style="font-size: 16px; line-height: 1.6; color: #374151;">
                Se tiver qualquer dúvida, é só responder este e-mail. Estou aqui para ajudar!
              </p>
              
              <p style="font-size: 16px; line-height: 1.6; color: #374151;">
                Um abraço,<br>
                <strong>Equipe Leados AI</strong>
              </p>
            </div>
            
            <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="font-size: 14px; color: #6b7280; margin: 0;">
                © 2024 Leados AI. Todos os direitos reservados.
              </p>
            </div>
          </div>
        `;
        break;

      case 3:
        subject = "Uma dica para potencializar seus leads 🚀";
        htmlContent = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">💡 Dica Profissional</h1>
            </div>
            
            <div style="padding: 40px 20px;">
              <p style="font-size: 16px; line-height: 1.6; color: #374151;">Olá ${name},</p>
              
              <p style="font-size: 16px; line-height: 1.6; color: #374151;">
                Sabia que você pode encontrar empresas que usam uma tecnologia específica? 
                Isso é ótimo para personalizar sua abordagem de vendas!
              </p>
              
              <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0;">
                <h3 style="color: #065f46; margin-top: 0;">🎯 Como usar filtros tecnológicos:</h3>
                <ul style="color: #374151;">
                  <li>Vá para "Qualificar Leads"</li>
                  <li>Use filtros como "Shopify", "Salesforce", "HubSpot"</li>
                  <li>Personalize sua abordagem baseada na stack tecnológica</li>
                </ul>
              </div>
              
              <p style="font-size: 16px; line-height: 1.6; color: #374151;">
                <strong>Exemplo prático:</strong> Se você vende integrações para e-commerce, 
                filtre por empresas que usam Shopify ou WooCommerce.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${Deno.env.get("SUPABASE_URL")}" 
                   style="background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                  Testar Agora
                </a>
              </div>
            </div>
          </div>
        `;
        break;

      case 5:
        subject = "Como a Agência X gerou 50 leads qualificados em 1 hora";
        htmlContent = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
            <div style="padding: 40px 20px;">
              <h1 style="color: #1f2937; font-size: 24px;">📈 Caso de Sucesso</h1>
              
              <p style="font-size: 16px; line-height: 1.6; color: #374151;">Olá ${name},</p>
              
              <p style="font-size: 16px; line-height: 1.6; color: #374151;">
                Quero compartilhar com você um caso real de como uma agência de marketing 
                conseguiu resultados incríveis com o Leados AI.
              </p>
              
              <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #1f2937; margin-top: 0;">🏆 Resultados da Agência MarketPro:</h3>
                <ul style="color: #374151;">
                  <li><strong>50 leads qualificados</strong> em apenas 1 hora</li>
                  <li><strong>Taxa de resposta de 45%</strong> (vs. 12% anterior)</li>
                  <li><strong>15 horas por semana economizadas</strong> em prospecção manual</li>
                  <li><strong>ROI de 300%</strong> no primeiro mês</li>
                </ul>
              </div>
              
              <p style="font-size: 16px; line-height: 1.6; color: #374151;">
                <strong>Como eles fizeram:</strong>
              </p>
              
              <ol style="color: #374151; line-height: 1.6;">
                <li>Definiram o perfil ideal do cliente (ICP)</li>
                <li>Usaram filtros de setor + faturamento + tecnologia</li>
                <li>Qualificaram automaticamente com nossa IA</li>
                <li>Exportaram direto para o CRM</li>
                <li>Criaram campanhas personalizadas</li>
              </ol>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${Deno.env.get("SUPABASE_URL")}" 
                   style="background: #f59e0b; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                  Replicar Estratégia
                </a>
              </div>
            </div>
          </div>
        `;
        break;

      case 7:
        subject = "Seu teste do Leados AI termina hoje!";
        htmlContent = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
            <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">⏰ Último Dia de Teste</h1>
            </div>
            
            <div style="padding: 40px 20px;">
              <p style="font-size: 16px; line-height: 1.6; color: #374151;">Olá ${name},</p>
              
              <p style="font-size: 16px; line-height: 1.6; color: #374151;">
                Seu acesso de teste termina em <strong>24 horas</strong>. 
                Para não perder os leads que você gerou e desbloquear todo o poder do Leados AI, 
                faça o upgrade agora.
              </p>
              
              <div style="background: #fef2f2; border: 2px solid #fecaca; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #991b1b; margin-top: 0;">🚨 O que você perde se não fizer upgrade:</h3>
                <ul style="color: #7f1d1d;">
                  <li>Acesso aos leads já gerados</li>
                  <li>Dados enriquecidos de CNPJ</li>
                  <li>Exportação para CRM</li>
                  <li>Integração WhatsApp</li>
                  <li>Suporte prioritário</li>
                </ul>
              </div>
              
              <div style="background: #ecfdf5; border: 2px solid #bbf7d0; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #065f46; margin-top: 0;">🎁 Oferta especial de última hora:</h3>
                <p style="color: #374151; margin: 0;">
                  Use o cupom <strong>BEMVINDO15</strong> para ter <strong>15% de desconto</strong> 
                  no seu primeiro mês do Plano Pro.
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${Deno.env.get("SUPABASE_URL")}" 
                   style="background: #ef4444; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 18px;">
                  Fazer Upgrade Agora
                </a>
              </div>
              
              <p style="font-size: 14px; line-height: 1.6; color: #6b7280; text-align: center;">
                Oferta válida apenas até hoje às 23:59
              </p>
            </div>
          </div>
        `;
        break;

      default:
        return new Response(
          JSON.stringify({ error: "Invalid day parameter" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const { data, error } = await resend.emails.send({
      from: "Leados AI <onboarding@resend.dev>",
      to: [email],
      subject,
      html: htmlContent,
    });

    if (error) {
      console.error("Resend error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to send email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the email in campaign_knowledge for tracking
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    await supabaseClient
      .from('campaign_knowledge')
      .insert({
        user_id,
        content: `Email de onboarding dia ${day} enviado para ${email}: ${subject}`,
      });

    return new Response(
      JSON.stringify({ success: true, message_id: data?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error sending onboarding email:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});