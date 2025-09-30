import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the LOVABLE_API_KEY from environment (automatically provided)
    const apiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!apiKey) {
      console.error("LOVABLE_API_KEY not found in environment, please enable the AI gateway");
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call the Lovable AI Gateway
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
				
				model: "google/gemini-2.5-flash",
				
        messages: [
					
          {
            role: "system",
            content: `Você é um assistente especializado em conta PJ do C6 Bank. Responda perguntas sobre:

- Abertura de conta PJ gratuita
- Benefícios: Pix ilimitado, 100 TEDs/boletos gratuitos
- Processo de aprovação e documentação
- Acesso a crédito empresarial
- Comparações com outros bancos
- Escritório autorizado Infinity

Sempre seja prestativo, objetivo e foque nos benefícios financeiros para empresas. Use linguagem profissional mas acessível.`,
          },
					
          {
            role: "user",
            content: message,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("AI Gateway error:", await response.text());
			if (response.status === 429) {
				console.error("Rate limit exceeded");
				return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
					status: 429,
					headers: { ...corsHeaders, "Content-Type": "application/json" },
				});
			}

      return new Response(JSON.stringify({ error: "Failed to get AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const aiMessage = data.choices?.[0]?.message?.content;

    if (!aiMessage) {
      console.error("No response from AI", data);
      return new Response(JSON.stringify({ error: "No response from AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ response: aiMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in AI call:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
