import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import sgMail from "npm:@sendgrid/mail";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

sgMail.setApiKey(Deno.env.get("SENDGRID_API_KEY") as string);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🚀 Testando envio de email via SendGrid...");
    
    const msg = {
      to: 'amoxx@outlook.com',
      from: 'contato@isf.net.br',
      subject: '🎉 Email de Teste - SendGrid está funcionando!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px; text-align: center;">
            <h1 style="color: white; margin: 0;">✅ Sucesso!</h1>
            <p style="color: white; font-size: 18px; margin-top: 10px;">
              SendGrid está configurado e funcionando perfeitamente!
            </p>
          </div>
          
          <div style="background: white; padding: 30px; margin-top: 20px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #1f2937;">🎯 Configuração Confirmada</h2>
            <p style="color: #374151; line-height: 1.6;">
              Seu sistema de emails está pronto para enviar:
            </p>
            
            <ul style="color: #374151; line-height: 1.8;">
              <li>✅ <strong>API Key:</strong> Validada</li>
              <li>✅ <strong>Domínio:</strong> isf.net.br</li>
              <li>✅ <strong>Remetente:</strong> contato@isf.net.br</li>
              <li>✅ <strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}</li>
            </ul>
            
            <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin-top: 20px;">
              <p style="color: #065f46; margin: 0;">
                <strong>💡 Próximo passo:</strong> Agora você pode enviar emails de campanha para seus 1000 leads!
              </p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px;">
            <p>© 2025 ISF - Sistema de Email Automatizado</p>
          </div>
        </div>
      `,
    };

    await sgMail.send(msg);
    
    console.log("✅ Email enviado com sucesso para amoxx@outlook.com");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email de teste enviado com sucesso para amoxx@outlook.com",
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("❌ Erro ao enviar email:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Erro ao enviar email",
        details: error
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
