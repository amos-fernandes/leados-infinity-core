import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, contactId, userId } = await req.json();
    
    console.log("📱 Validando WhatsApp:", phone);

    if (!phone) {
      throw new Error('Telefone não fornecido');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Limpar e formatar número
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    let validationResult = {
      hasWhatsApp: false,
      isValid: false,
      profile: null as any,
      businessInfo: null as any
    };

    // 1. Tentar validar com Evolution API (se configurada)
    try {
      const evolutionKey = Deno.env.get('EVOLUTION_AUTHENTICATION_KEY');
      const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
      
      if (evolutionKey && evolutionUrl) {
        console.log("🔍 Validando com Evolution API...");
        
        const checkResponse = await fetch(`${evolutionUrl}/chat/whatsappNumbers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionKey
          },
          body: JSON.stringify({
            numbers: [formattedPhone]
          })
        });

        if (checkResponse.ok) {
          const checkData = await checkResponse.json();
          console.log("✅ Resultado Evolution:", checkData);
          
          if (checkData && checkData.length > 0) {
            validationResult.hasWhatsApp = checkData[0].exists || false;
            validationResult.isValid = checkData[0].exists || false;
            
            // Tentar obter perfil
            try {
              const profileResponse = await fetch(`${evolutionUrl}/chat/fetchProfile/${formattedPhone}`, {
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': evolutionKey
                }
              });

              if (profileResponse.ok) {
                const profileData = await profileResponse.json();
                validationResult.profile = {
                  name: profileData.name || profileData.pushname,
                  status: profileData.status,
                  picture: profileData.picture,
                  isBusiness: profileData.isBusiness || false
                };

                // Se for business, tentar obter info comercial
                if (profileData.isBusiness) {
                  try {
                    const businessResponse = await fetch(`${evolutionUrl}/chat/fetchBusinessProfile/${formattedPhone}`, {
                      headers: {
                        'Content-Type': 'application/json',
                        'apikey': evolutionKey
                      }
                    });

                    if (businessResponse.ok) {
                      const businessData = await businessResponse.json();
                      validationResult.businessInfo = {
                        description: businessData.description,
                        category: businessData.category,
                        address: businessData.address,
                        website: businessData.website,
                        email: businessData.email
                      };
                    }
                  } catch (error) {
                    console.log("⚠️ Erro ao buscar perfil business:", error);
                  }
                }
              }
            } catch (error) {
              console.log("⚠️ Erro ao buscar perfil:", error);
            }
          }
        }
      }
    } catch (error) {
      console.log("⚠️ Evolution API não disponível:", error);
    }

    // 2. Se Evolution falhou, tentar validação básica
    if (!validationResult.isValid) {
      console.log("🔍 Fazendo validação básica de formato...");
      
      // Validação básica de formato brasileiro
      const brazilianPattern = /^55\d{10,11}$/;
      validationResult.isValid = brazilianPattern.test(formattedPhone);
      validationResult.hasWhatsApp = validationResult.isValid; // Assumir que números válidos podem ter WhatsApp
    }

    // 3. Atualizar contato no banco de dados
    if (contactId && validationResult.isValid) {
      const updateData: any = {
        whatsapp_validado: validationResult.hasWhatsApp,
        telefone: formattedPhone,
        updated_at: new Date().toISOString()
      };

      if (validationResult.profile) {
        updateData.observacoes = JSON.stringify({
          whatsapp_profile: validationResult.profile,
          business_info: validationResult.businessInfo,
          validated_at: new Date().toISOString()
        });
      }

      const { error: updateError } = await supabaseClient
        .from('contacts')
        .update(updateData)
        .eq('id', contactId);

      if (updateError) {
        console.error("❌ Erro ao atualizar contato:", updateError);
      } else {
        console.log("✅ Contato atualizado com validação WhatsApp");
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        phone: formattedPhone,
        ...validationResult,
        enrichedAt: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("❌ Erro na validação WhatsApp:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
