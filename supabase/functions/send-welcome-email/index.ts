import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface WelcomeEmailRequest {
  user_id: string;
  email: string;
  name: string;
  plan: 'pro' | 'enterprise';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { user_id, email, name, plan }: WelcomeEmailRequest = await req.json();

    if (!user_id || !email || !name || !plan) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const planName = plan === 'pro' ? 'Pro' : 'Enterprise';
    const planFeatures = plan === 'pro' 
      ? ['500 leads por mês', 'Dados enriquecidos', 'Exportação CRM', 'Integração WhatsApp']
      : ['2000 leads por mês', 'API dedicada', 'Múltiplos usuários', 'Account manager'];

    const subject = `Oficialmente parte da família Leados AI! 🎉`;
    
    const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">🎉 Bem-vindo à família!</h1>
        </div>
        
        <div style="padding: 40px 20px;">
          <p style="font-size: 18px; line-height: 1.6; color: #374151; font-weight: bold;">
            Uau, ${name}! 
          </p>
          
          <p style="font-size: 16px; line-height: 1.6; color: #374151;">
            Estamos muito felizes em ter você conosco no <strong>Plano ${planName}</strong>! 
            Você agora faz parte de uma comunidade de mais de 1.500 empresas que transformaram 
            sua prospecção com o Leados AI.
          </p>
          
          <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; margin: 30px 0;">
            <h3 style="color: #065f46; margin-top: 0;">🚀 Seus novos superpoderes desbloqueados:</h3>
            <ul style="color: #374151; margin: 0;">
              ${planFeatures.map(feature => `<li style="margin: 8px 0;">${feature}</li>`).join('')}
            </ul>
          </div>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 30px 0;">
            <h3 style="color: #1f2937; margin-top: 0;">📞 Nossa equipe está aqui para você</h3>
            <p style="color: #374151; margin: 0;">
              Minha equipe e eu estamos aqui para garantir que você tenha o máximo de sucesso. 
              Se precisar de qualquer coisa, é só responder este e-mail que nossa equipe 
              de sucesso do cliente entrará em contato em até 2 horas.
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${Deno.env.get("SUPABASE_URL")}" 
               style="background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; margin-right: 10px;">
              Acessar Dashboard
            </a>
            <a href="mailto:suporte@leadosai.com" 
               style="background: #6b7280; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              Falar com Suporte
            </a>
          </div>
          
          <div style="background: #fef3c7; border: 2px solid #fbbf24; padding: 20px; border-radius: 8px; margin: 30px 0;">
            <h3 style="color: #92400e; margin-top: 0;">🎁 Bônus especial para você:</h3>
            <p style="color: #374151;">
              Como novo cliente ${planName}, você tem acesso gratuito ao nosso 
              <strong>Treinamento VIP de Prospecção Avançada</strong> (valor: R$ 497).
            </p>
            <a href="#" style="color: #92400e; font-weight: bold;">Agendar meu treinamento →</a>
          </div>
          
          <p style="font-size: 16px; line-height: 1.6; color: #374151;">
            Mais uma vez, bem-vindo à bordo! Estamos ansiosos para ver seus resultados.
          </p>
          
          <p style="font-size: 16px; line-height: 1.6; color: #374151;">
            Um abraço,<br>
            <strong>Equipe Leados AI</strong><br>
            <span style="color: #6b7280;">Sucesso do Cliente</span>
          </p>
        </div>
        
        <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
          <div style="margin-bottom: 15px;">
            <a href="#" style="color: #6b7280; text-decoration: none; margin: 0 10px;">Centro de Ajuda</a>
            <a href="#" style="color: #6b7280; text-decoration: none; margin: 0 10px;">Tutoriais</a>
            <a href="#" style="color: #6b7280; text-decoration: none; margin: 0 10px;">Comunidade</a>
          </div>
          <p style="font-size: 14px; color: #6b7280; margin: 0;">
            © 2024 Leados AI. Todos os direitos reservados.
          </p>
        </div>
      </div>
    `;

    const { data, error } = await resend.emails.send({
      from: "Leados AI <welcome@resend.dev>",
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
        content: `Email de boas-vindas enviado para cliente ${plan}: ${email} - ${subject}`,
      });

    return new Response(
      JSON.stringify({ success: true, message_id: data?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error sending welcome email:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});