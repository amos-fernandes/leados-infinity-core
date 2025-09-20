import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface UpsellEmailRequest {
  user_id: string;
  email: string;
  name: string;
  current_plan: 'gratuito' | 'pro';
  leads_used: number;
  leads_limit: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { 
      user_id, 
      email, 
      name, 
      current_plan, 
      leads_used, 
      leads_limit 
    }: UpsellEmailRequest = await req.json();

    if (!user_id || !email || !name || !current_plan || leads_used === undefined || !leads_limit) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const usagePercentage = Math.round((leads_used / leads_limit) * 100);
    const isNearLimit = usagePercentage >= 85;
    
    if (!isNearLimit) {
      return new Response(
        JSON.stringify({ message: "User not near limit, no email sent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let subject = "";
    let htmlContent = "";
    let nextPlan = "";
    let nextPlanLimit = "";
    let nextPlanPrice = "";

    if (current_plan === 'gratuito') {
      subject = `Você está quase no seu limite de leads do Leados AI`;
      nextPlan = "Pro";
      nextPlanLimit = "500";
      nextPlanPrice = "R$ 97";
    } else if (current_plan === 'pro') {
      subject = `Hora de escalar? Você está usando ${usagePercentage}% dos seus leads`;
      nextPlan = "Enterprise";
      nextPlanLimit = "2000";
      nextPlanPrice = "R$ 297";
    }

    htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">⚡️ Você está prospectando a todo vapor!</h1>
        </div>
        
        <div style="padding: 40px 20px;">
          <p style="font-size: 16px; line-height: 1.6; color: #374151;">Olá ${name},</p>
          
          <p style="font-size: 16px; line-height: 1.6; color: #374151;">
            Percebemos que você está prospectando a todo vapor! 🚀 
            Você já utilizou <strong>${leads_used} de ${leads_limit} leads</strong> 
            (${usagePercentage}% do seu limite).
          </p>
          
          <div style="background: #fef3c7; border: 2px solid #fbbf24; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #92400e; margin-top: 0;">📊 Seu uso atual:</h3>
            <div style="background: #f3f4f6; border-radius: 8px; padding: 3px; margin: 10px 0;">
              <div style="background: #f59e0b; width: ${usagePercentage}%; height: 20px; border-radius: 6px; position: relative;">
                <span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-size: 12px; font-weight: bold;">
                  ${usagePercentage}%
                </span>
              </div>
            </div>
            <p style="color: #374151; margin: 10px 0 0 0; font-size: 14px;">
              ${leads_used}/${leads_limit} leads utilizados este mês
            </p>
          </div>
          
          <p style="font-size: 16px; line-height: 1.6; color: #374151;">
            Para evitar interrupções na sua prospecção, considere fazer o upgrade para o 
            <strong>Plano ${nextPlan}</strong> e tenha acesso a ${nextPlanLimit} leads por mês.
          </p>
          
          <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0;">
            <h3 style="color: #065f46; margin-top: 0;">🎯 Com o Plano ${nextPlan} você terá:</h3>
            <ul style="color: #374151; margin: 0;">
              ${current_plan === 'gratuito' ? `
                <li>500 leads por mês (50x mais que o gratuito)</li>
                <li>Dados enriquecidos de CNPJ e receita</li>
                <li>Exportação direta para CRM</li>
                <li>Integração WhatsApp/Email</li>
                <li>Análise de tecnologias</li>
                <li>Suporte prioritário</li>
              ` : `
                <li>2000 leads por mês (4x mais que o Pro)</li>
                <li>API dedicada para integrações</li>
                <li>Múltiplos usuários na conta</li>
                <li>Relatórios avançados</li>
                <li>Account manager dedicado</li>
                <li>SLA garantido</li>
              `}
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${Deno.env.get("SUPABASE_URL")}" 
               style="background: #f59e0b; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
              Upgrade para ${nextPlan} - ${nextPlanPrice}/mês
            </a>
          </div>
          
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <p style="color: #6b7280; margin: 0; font-size: 14px;">
              💡 <strong>Dica:</strong> Clientes que fazem upgrade geram em média 3x mais oportunidades
            </p>
          </div>
          
          <p style="font-size: 16px; line-height: 1.6; color: #374151;">
            Tem alguma dúvida sobre o upgrade? É só responder este e-mail que nossa equipe 
            entrará em contato em até 1 hora para ajudar.
          </p>
          
          <p style="font-size: 16px; line-height: 1.6; color: #374151;">
            Continue prospectando com sucesso!<br>
            <strong>Equipe Leados AI</strong>
          </p>
        </div>
        
        <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 14px; color: #6b7280; margin: 0;">
            © 2024 Leados AI. Todos os direitos reservados.
          </p>
          <p style="font-size: 12px; color: #9ca3af; margin: 5px 0 0 0;">
            Não quer mais receber esses e-mails? <a href="#" style="color: #9ca3af;">Cancelar inscrição</a>
          </p>
        </div>
      </div>
    `;

    const { data, error } = await resend.emails.send({
      from: "Leados AI <upsell@resend.dev>",
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
        content: `Email de upsell enviado para ${email}: ${usagePercentage}% de uso (${leads_used}/${leads_limit}) - Plano atual: ${current_plan}`,
      });

    return new Response(
      JSON.stringify({ success: true, message_id: data?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error sending upsell email:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});