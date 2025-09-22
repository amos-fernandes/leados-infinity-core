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

    const scrapingBeeApiKey = Deno.env.get('SCRAPINGBEE_API_KEY');
    if (!scrapingBeeApiKey) {
      return new Response(JSON.stringify({ 
        error: 'ScrapingBee API Key não configurado' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Scraping Google Maps for:', searchQuery, 'in', location);

    // Construir URL do Google Maps
    const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}${location ? `+${encodeURIComponent(location)}` : ''}`;
    
    // Usar ScrapingBee para fazer scraping do Google Maps
    const scrapingUrl = new URL('https://app.scrapingbee.com/api/v1/');
    scrapingUrl.searchParams.append('api_key', scrapingBeeApiKey);
    scrapingUrl.searchParams.append('url', mapsUrl);
    scrapingUrl.searchParams.append('render_js', 'true');
    scrapingUrl.searchParams.append('wait', '3000');
    scrapingUrl.searchParams.append('window_width', '1920');
    scrapingUrl.searchParams.append('window_height', '1080');

    const response = await fetch(scrapingUrl.toString());
    
    if (!response.ok) {
      throw new Error(`ScrapingBee API error: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    console.log('Google Maps HTML scraped, length:', html.length);

    // Extrair informações de empresas usando regex
    const businesses = extractBusinessesFromGoogleMaps(html);
    console.log('Extracted businesses:', businesses.length);

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

function extractBusinessesFromGoogleMaps(html: string) {
  const businesses: any[] = [];
  
  try {
    // Regex para extrair dados de empresas do Google Maps
    const businessRegex = /class="fontHeadlineSmall"[^>]*>([^<]+)<.*?class="fontBodyMedium"[^>]*>([^<]+)<.*?href="tel:([^"]+)"/gs;
    const phoneRegex = /(\+55\s?\(?1[1-9]\)?\s?\d{4,5}-?\d{4}|\+55\s?\(?[1-9][1-9]\)?\s?\d{4,5}-?\d{4}|1[1-9]\s?\d{4,5}-?\d{4}|[1-9][1-9]\s?\d{4,5}-?\d{4})/g;
    const whatsappRegex = /(api\.whatsapp\.com\/send\?phone=|wa\.me\/)(\+?55)?(\d{10,11})/gi;
    
    let match;
    while ((match = businessRegex.exec(html)) !== null) {
      const name = match[1]?.trim();
      const category = match[2]?.trim();
      const phone = match[3]?.replace(/\D/g, '');
      
      if (name && phone) {
        businesses.push({
          name,
          category,
          phone: formatPhone(phone),
          whatsapp: checkIfWhatsApp(phone),
          website: null
        });
      }
    }

    // Buscar números de telefone adicionais
    const additionalPhones = html.match(phoneRegex) || [];
    additionalPhones.forEach(phone => {
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length >= 10 && !businesses.find(b => b.phone === formatPhone(cleanPhone))) {
        businesses.push({
          name: 'Empresa (Google Maps)',
          category: 'Não identificado',
          phone: formatPhone(cleanPhone),
          whatsapp: formatPhone(cleanPhone),
          website: null
        });
      }
    });

    // Buscar links de WhatsApp
    let whatsappMatch;
    while ((whatsappMatch = whatsappRegex.exec(html)) !== null) {
      const phone = whatsappMatch[3];
      if (phone && !businesses.find(b => b.whatsapp?.includes(phone))) {
        businesses.push({
          name: 'Empresa WhatsApp (Google Maps)',
          category: 'WhatsApp',
          phone: formatPhone(phone),
          whatsapp: formatPhone(phone),
          website: null
        });
      }
    }

  } catch (error) {
    console.error('Error parsing Google Maps HTML:', error);
  }

  return businesses.slice(0, 50); // Limitar a 50 resultados
}

function formatPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 11 && clean.startsWith('55')) {
    return clean;
  }
  if (clean.length === 10 || clean.length === 11) {
    return `55${clean}`;
  }
  return clean;
}

function checkIfWhatsApp(phone: string): string | null {
  // Para números brasileiros, assumir que números mobile podem ter WhatsApp
  const clean = phone.replace(/\D/g, '');
  if (clean.length >= 10) {
    const formatted = formatPhone(clean);
    // Verificar se é número móvel (9 como primeiro dígito após o DDD)
    if (formatted.length === 13 && formatted.charAt(4) === '9') {
      return formatted;
    }
  }
  return null;
}