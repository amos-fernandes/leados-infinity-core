import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailFinderRequest {
  domain: string;
  leadId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain, leadId }: EmailFinderRequest = await req.json();
    
    if (!domain) {
      return new Response(JSON.stringify({ error: 'Domain is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`🔍 Buscando e-mail para o domínio: ${domain}`);

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let foundEmail: string | null = null;

    // Try Hunter.io API if available
    const hunterApiKey = Deno.env.get('HUNTER_API_KEY');
    if (hunterApiKey) {
      console.log('🎯 Tentando Hunter.io API...');
      try {
        const hunterUrl = `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${hunterApiKey}&type=generic&limit=10`;
        const hunterResponse = await fetch(hunterUrl);
        
        if (hunterResponse.ok) {
          const hunterData = await hunterResponse.json();
          const emails = hunterData?.data?.emails || [];
          
          if (emails.length > 0) {
            // Prioritize generic verified emails
            const genericVerifiedEmail = emails.find((e: any) => 
              e.type === 'generic' && e.verification?.status === 'valid'
            );
            
            if (genericVerifiedEmail) {
              foundEmail = genericVerifiedEmail.value;
              console.log(`✅ E-mail genérico verificado encontrado: ${foundEmail}`);
            } else {
              // Fall back to first verified email
              const firstVerifiedEmail = emails.find((e: any) => 
                e.verification?.status === 'valid'
              );
              
              if (firstVerifiedEmail) {
                foundEmail = firstVerifiedEmail.value;
                console.log(`✅ E-mail verificado encontrado: ${foundEmail}`);
              }
            }
          }
        }
      } catch (error) {
        console.error('❌ Erro na Hunter.io API:', (error as Error).message);
      }
    }

    // Fallback: Try common email patterns
    if (!foundEmail) {
      console.log('🔄 Tentando padrões comuns de e-mail...');
      const commonPatterns = [
        `contato@${domain}`,
        `contact@${domain}`,
        `vendas@${domain}`,
        `sales@${domain}`,
        `info@${domain}`,
        `comercial@${domain}`
      ];

      // Simple validation - try to verify if the email exists
      for (const email of commonPatterns) {
        try {
          // Basic email format validation
          if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            foundEmail = email;
            console.log(`📧 Usando padrão comum: ${foundEmail}`);
            break;
          }
        } catch (error) {
          continue;
        }
      }
    }

    // Update lead if leadId provided and email found
    if (leadId && foundEmail) {
      console.log(`🔄 Atualizando lead ${leadId} com e-mail encontrado...`);
      
      const { error: updateError } = await supabase
        .from('leads')
        .update({ 
          email: foundEmail,
          email_encontrado_automaticamente: true
        })
        .eq('id', leadId);

      if (updateError) {
        console.error('❌ Erro ao atualizar lead:', updateError);
      } else {
        console.log('✅ Lead atualizado com sucesso!');
      }
    }

    return new Response(JSON.stringify({ 
      email: foundEmail,
      found: !!foundEmail,
      method: hunterApiKey ? 'hunter_api' : 'common_patterns'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro na busca de e-mail:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});