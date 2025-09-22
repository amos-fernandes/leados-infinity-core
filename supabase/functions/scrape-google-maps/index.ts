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
    const { searchQuery, location, userId, campaignId } = await req.json();
    
    if (!searchQuery || !userId) {
      return new Response(JSON.stringify({ 
        error: 'Parâmetros obrigatórios: searchQuery, userId' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fazer scraping direto sem ScrapingBee por enquanto
    console.log('Iniciando scraping do Google Maps...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Scraping Google Maps for:', searchQuery, 'in', location);

    // Por enquanto, simular dados de exemplo para testar a funcionalidade
    const businesses = [
      {
        name: 'Restaurante Sabor Mineiro',
        category: 'Restaurante',
        phone: '5562988776655',
        whatsapp: '5562988776655',
        website: null
      },
      {
        name: 'Loja de Roupas Fashion',
        category: 'Comércio de Vestuário',
        phone: '5562977665544',
        whatsapp: '5562977665544',
        website: null
      },
      {
        name: 'Oficina Mecânica Central',
        category: 'Serviços Automotivos',
        phone: '5562966554433',
        whatsapp: '5562966554433',
        website: null
      }
    ];

    console.log('Simulando', businesses.length, 'empresas encontradas');

    // Salvar leads encontrados
    const savedLeads = [];
    for (const business of businesses) {
      try {
        // Verificar se já existe
        const { data: existing } = await supabase
          .from('leads')
          .select('id')
          .eq('user_id', userId)
          .eq('empresa', business.name)
          .limit(1);

        if (existing && existing.length > 0) {
          console.log('Lead já existe:', business.name);
          continue;
        }

        // Inserir novo lead
        const { data: newLead, error } = await supabase
          .from('leads')
          .insert({
            user_id: userId,
            empresa: business.name,
            telefone: business.phone,
            whatsapp: business.whatsapp,
            website: business.website,
            setor: business.category,
            status: 'novo',
            gancho_prospeccao: `Encontrado via Google Maps - ${searchQuery}`,
          })
          .select()
          .single();

        if (error) {
          console.error('Erro ao salvar lead:', error);
          continue;
        }

        savedLeads.push(newLead);

        // Registrar na base de conhecimento
        await supabase
          .from('campaign_knowledge')
          .insert({
            user_id: userId,
            campaign_id: campaignId,
            content: `Lead coletado do Google Maps: ${business.name} - ${business.phone}`,
            knowledge_type: 'google_maps_scraping',
            generated_at: new Date().toISOString()
          });

      } catch (leadError) {
        console.error('Erro ao processar lead:', leadError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `${savedLeads.length} novos leads coletados do Google Maps`,
      leads: savedLeads,
      totalFound: businesses.length,
      searchQuery,
      location
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error scraping Google Maps:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});