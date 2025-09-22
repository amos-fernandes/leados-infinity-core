import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const scrapingBeeApiKey = Deno.env.get('SCRAPINGBEE_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RecentEvent {
  title: string;
  description: string;
  date: string;
  source: string;
  url?: string;
  relevanceScore: number;
}

async function searchGoogleNews(companyName: string): Promise<RecentEvent[]> {
  if (!scrapingBeeApiKey) return [];

  try {
    const searchQuery = encodeURIComponent(`"${companyName}" (investimento OR expansão OR crescimento OR aquisição OR fusão OR IPO OR resultado)`);
    const googleNewsUrl = `https://news.google.com/search?q=${searchQuery}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;

    const scrapingUrl = new URL('https://app.scrapingbee.com/api/v1/');
    scrapingUrl.searchParams.append('api_key', scrapingBeeApiKey);
    scrapingUrl.searchParams.append('url', googleNewsUrl);
    scrapingUrl.searchParams.append('render_js', 'true');
    scrapingUrl.searchParams.append('country_code', 'br');

    const response = await fetch(scrapingUrl.toString());
    
    if (!response.ok) {
      console.error(`Google News scraping failed: ${response.statusText}`);
      return [];
    }

    const html = await response.text();
    
    // Extrair notícias do HTML do Google News
    const events: RecentEvent[] = [];
    
    // Regex para encontrar artigos de notícias
    const articleRegex = /<article[^>]*>.*?<\/article>/gs;
    const titleRegex = /<h3[^>]*>(.*?)<\/h3>/s;
    const timeRegex = /<time[^>]*datetime="([^"]*)"[^>]*>(.*?)<\/time>/s;
    
    const articles = html.match(articleRegex) || [];
    
    for (const article of articles.slice(0, 5)) { // Limitar a 5 resultados
      const titleMatch = article.match(titleRegex);
      const timeMatch = article.match(timeRegex);
      
      if (titleMatch && titleMatch[1]) {
        const title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
        const date = timeMatch ? timeMatch[1] : new Date().toISOString();
        
        // Calcular relevância baseada em palavras-chave
        const relevanceKeywords = ['investimento', 'expansão', 'crescimento', 'aquisição', 'fusão', 'resultado', 'lucro', 'receita'];
        let relevanceScore = 0;
        
        for (const keyword of relevanceKeywords) {
          if (title.toLowerCase().includes(keyword)) {
            relevanceScore++;
          }
        }
        
        events.push({
          title,
          description: title, // No Google News, usamos o título como descrição
          date,
          source: 'Google News',
          relevanceScore
        });
      }
    }

    return events.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
  } catch (error) {
    console.error('Erro ao buscar no Google News:', error);
    return [];
  }
}

async function searchInstagramPosts(companyName: string): Promise<RecentEvent[]> {
  if (!scrapingBeeApiKey) return [];

  try {
    // Buscar perfil da empresa no Instagram
    const instagramUrl = `https://www.instagram.com/${companyName.toLowerCase().replace(/\s+/g, '')}/`;
    
    const scrapingUrl = new URL('https://app.scrapingbee.com/api/v1/');
    scrapingUrl.searchParams.append('api_key', scrapingBeeApiKey);
    scrapingUrl.searchParams.append('url', instagramUrl);
    scrapingUrl.searchParams.append('render_js', 'true');
    scrapingUrl.searchParams.append('premium_proxy', 'true');

    const response = await fetch(scrapingUrl.toString());
    
    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    
    // Buscar por posts recentes no HTML
    const events: RecentEvent[] = [];
    
    // Regex simplificado para encontrar possíveis posts
    const postRegex = /"edge_media_to_caption":\s*{\s*"edges":\s*\[\s*{\s*"node":\s*{\s*"text":\s*"([^"]*)"}/g;
    const matches = html.matchAll(postRegex);
    
    for (const match of matches) {
      if (events.length >= 3) break; // Limitar a 3 posts
      
      const text = match[1];
      if (text && text.length > 10) {
        events.push({
          title: `Post recente no Instagram`,
          description: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
          date: new Date().toISOString(),
          source: 'Instagram',
          relevanceScore: 1
        });
      }
    }

    return events;
    
  } catch (error) {
    console.error('Erro ao buscar no Instagram:', error);
    return [];
  }
}

function generateFallbackEvents(companyName: string, sector?: string): RecentEvent[] {
  const fallbackMessages = [
    {
      title: `Oportunidade de expansão para ${companyName}`,
      description: `Empresas do setor ${sector || 'atual'} estão apresentando crescimento acima da média. Momento ideal para otimização tributária e planejamento fiscal estratégico.`,
      source: 'Análise de Mercado',
      relevanceScore: 2
    },
    {
      title: `Mudanças tributárias podem impactar ${companyName}`,
      description: `Novas regulamentações fiscais estão sendo implementadas. Recomenda-se revisão do planejamento tributário para manter competitividade.`,
      source: 'Análise Fiscal',
      relevanceScore: 2
    },
    {
      title: `Tendências do setor favorecem ${companyName}`,
      description: `Análise de mercado indica oportunidades de crescimento para empresas do setor. Planejamento fiscal adequado é essencial para aproveitar o momento.`,
      source: 'Análise Setorial',
      relevanceScore: 1
    }
  ];

  return fallbackMessages.map(msg => ({
    ...msg,
    date: new Date().toISOString()
  }));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyName, sector, leadId, userId } = await req.json();

    if (!companyName) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Nome da empresa é obrigatório' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Buscar eventos em paralelo
    const [newsEvents, instagramEvents] = await Promise.all([
      searchGoogleNews(companyName),
      searchInstagramPosts(companyName)
    ]);

    let allEvents = [...newsEvents, ...instagramEvents];

    // Se não encontrou nada relevante, usar fallback
    if (allEvents.length === 0 || allEvents.every(e => e.relevanceScore < 2)) {
      const fallbackEvents = generateFallbackEvents(companyName, sector);
      allEvents = [...allEvents, ...fallbackEvents];
    }

    // Ordenar por relevância e pegar os melhores
    allEvents = allEvents
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 3);

    // Atualizar lead no banco se fornecido
    if (leadId && userId && allEvents.length > 0) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const bestEvent = allEvents[0];
      const eventSummary = `${bestEvent.title} - ${bestEvent.description.substring(0, 100)}...`;
      
      const { error } = await supabase
        .from('leads')
        .update({
          recent_events: eventSummary,
          last_event_date: bestEvent.date
        })
        .eq('id', leadId)
        .eq('user_id', userId);

      if (error) {
        console.error('Erro ao atualizar lead:', error);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      data: {
        events: allEvents,
        totalFound: allEvents.length,
        hasFallback: allEvents.some(e => e.source.includes('Análise'))
      },
      message: `Encontrados ${allEvents.length} eventos relevantes para ${companyName}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in scrape-recent-events function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Erro interno do servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});