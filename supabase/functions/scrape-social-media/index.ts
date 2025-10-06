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
    const { profiles, platform, userId, campaignId } = await req.json();
    
    if (!profiles || !Array.isArray(profiles) || !userId || !platform) {
      return new Response(JSON.stringify({ 
        error: 'Parâmetros obrigatórios: profiles (array), platform, userId' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 🔑 Configurar APIs avançadas
    const APIFY_API_KEY = Deno.env.get('APIFY_API_KEY');
    const HUNTER_API_KEY = Deno.env.get('HUNTER_API_KEY');
    const ABSTRACT_EMAIL_API_KEY = Deno.env.get('ABSTRACT_EMAIL_API_KEY');
    
    if (!APIFY_API_KEY) {
      return new Response(JSON.stringify({ 
        error: 'APIFY_API_KEY não configurado. Configure nas secrets do backend.' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`🚀 Iniciando scraping avançado de ${platform} com Apify`);
    console.log(`📊 Total de perfis para processar: ${profiles.length}`);

    const results = [];
    const savedLeads = [];
    let businessProfilesCount = 0;
    let verifiedProfilesCount = 0;

    // Processar até 10 perfis por vez para evitar timeout
    for (const profileUrl of profiles.slice(0, 10)) {
      try {
        console.log(`🔍 Processando: ${profileUrl}`);
        
        let profileData;
        
        if (platform === 'instagram') {
          profileData = await scrapeInstagramWithApify(profileUrl, APIFY_API_KEY, HUNTER_API_KEY, ABSTRACT_EMAIL_API_KEY);
        } else if (platform === 'facebook') {
          profileData = await scrapeFacebookWithApify(profileUrl, APIFY_API_KEY, HUNTER_API_KEY, ABSTRACT_EMAIL_API_KEY);
        } else {
          throw new Error('Plataforma não suportada. Use: instagram ou facebook');
        }

        results.push(profileData);

        // 🎯 Filtrar apenas perfis comerciais com informações úteis
        if (profileData.isBusinessProfile || profileData.isVerified || 
            profileData.phone || profileData.email || profileData.whatsapp) {
          
          if (profileData.isBusinessProfile) businessProfilesCount++;
          if (profileData.isVerified) verifiedProfilesCount++;

          // Verificar se lead já existe
          const { data: existing } = await supabase
            .from('leads')
            .select('id')
            .eq('user_id', userId)
            .or(`empresa.eq.${profileData.name},whatsapp.eq.${profileData.whatsapp},email.eq.${profileData.email}`)
            .limit(1);

          if (existing && existing.length > 0) {
            console.log('✓ Lead já existe:', profileData.name);
            continue;
          }

          // 💾 Inserir novo lead comercial
          const { data: newLead, error } = await supabase
            .from('leads')
            .insert({
              user_id: userId,
              empresa: profileData.name,
              telefone: profileData.phone,
              whatsapp: profileData.whatsapp,
              email: profileData.email,
              website: profileData.website,
              linkedin: platform === 'instagram' ? profileUrl : null,
              setor: profileData.category || `${platform} Business`,
              status: 'novo',
              gancho_prospeccao: `${profileData.isVerified ? '✓ VERIFICADO ' : ''}${profileData.isBusinessProfile ? '🏢 COMERCIAL ' : ''}| ${profileData.bio || 'Perfil encontrado'}`,
            })
            .select()
            .single();

          if (error) {
            console.error('❌ Erro ao salvar lead:', error);
            continue;
          }

          savedLeads.push(newLead);
          console.log(`✅ Lead comercial salvo: ${profileData.name}`);

          // 📝 Registrar na base de conhecimento
          await supabase
            .from('campaign_knowledge')
            .insert({
              user_id: userId,
              campaign_id: campaignId,
              content: `🎯 Lead ${profileData.isVerified ? 'VERIFICADO' : ''} coletado do ${platform}: ${profileData.name} | Comercial: ${profileData.isBusinessProfile ? 'Sim' : 'Não'} | WhatsApp: ${profileData.whatsapp || 'N/A'} | Email: ${profileData.email || 'N/A'} | Seguidores: ${profileData.followers || 0}`,
              knowledge_type: 'social_media_advanced_scraping',
            });
        }

      } catch (profileError) {
        console.error(`❌ Erro ao processar perfil ${profileUrl}:`, profileError);
        results.push({
          profile: profileUrl,
          success: false,
          error: profileError instanceof Error ? profileError.message : 'Erro desconhecido',
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `✅ ${savedLeads.length} novos leads comerciais coletados do ${platform}`,
      leads: savedLeads,
      stats: {
        totalProcessed: results.length,
        totalSaved: savedLeads.length,
        businessProfiles: businessProfilesCount,
        verifiedProfiles: verifiedProfilesCount,
        successRate: `${((savedLeads.length / results.length) * 100).toFixed(1)}%`
      },
      scrapingResults: results,
      platform: platform,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error scraping social media:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// 🚀 APIFY INSTAGRAM SCRAPER - Recursos Avançados
async function scrapeInstagramWithApify(
  profileUrl: string, 
  apifyKey: string, 
  hunterKey: string | undefined, 
  abstractEmailKey: string | undefined
) {
  try {
    const username = profileUrl.split('/').filter(Boolean).pop()?.replace('@', '');
    console.log(`📸 Iniciando Apify Instagram Scraper para: @${username}`);
    
    // Iniciar Apify Instagram Profile Scraper
    const actorResponse = await fetch(`https://api.apify.com/v2/acts/apify~instagram-profile-scraper/runs?token=${apifyKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        directUrls: [profileUrl],
        resultsType: 'details',
        searchLimit: 1,
        addParentData: true,
      })
    });

    if (!actorResponse.ok) {
      throw new Error(`Apify API error: ${actorResponse.status}`);
    }

    const runData = await actorResponse.json();
    const runId = runData.data.id;
    console.log(`⏳ Apify run iniciado: ${runId}`);

    // Aguardar conclusão (máx 60 segundos)
    let attempts = 0;
    let runStatus = 'RUNNING';
    while (runStatus === 'RUNNING' && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const statusResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apifyKey}`);
      const statusData = await statusResponse.json();
      runStatus = statusData.data.status;
      attempts++;
      console.log(`⏳ Status: ${runStatus} (tentativa ${attempts}/30)`);
    }

    if (runStatus !== 'SUCCEEDED') {
      throw new Error(`Apify run falhou com status: ${runStatus}`);
    }

    // Obter resultados
    const resultsResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apifyKey}`);
    const results = await resultsResponse.json();
    
    if (!results || results.length === 0) {
      throw new Error('Nenhum dado retornado do Apify');
    }

    const profile = results[0];
    console.log(`✅ Dados extraídos: @${profile.username}`);

    // 🎯 Identificar perfil comercial
    const isBusinessProfile = profile.businessCategoryName || profile.isBusinessAccount || 
                             profile.category || false;
    const isVerified = profile.verified || profile.isVerified || false;
    const bio = profile.biography || '';
    
    // 📞 Extrair contatos da bio
    const phoneMatch = bio.match(/(\+?55\s?)?\(?(\d{2})\)?\s?9?\s?\d{4}[\s-]?\d{4}/);
    const emailMatch = bio.match(/[\w\.-]+@[\w\.-]+\.\w+/);
    const whatsappMatch = bio.match(/wa\.me\/(\d+)|whatsapp.*?(\d{10,})/i);
    
    let phone = phoneMatch ? formatPhone(phoneMatch[0]) : null;
    let email = emailMatch ? emailMatch[0] : null;
    let whatsapp = whatsappMatch ? formatPhone(whatsappMatch[1] || whatsappMatch[2]) : phone;

    // 📱 Extrair WhatsApp de botões de ação
    if (profile.businessContactMethod === 'WHATSAPP' || profile.whatsappNumber) {
      whatsapp = formatPhone(profile.whatsappNumber || profile.contactPhoneNumber);
      if (!phone) phone = whatsapp;
    }

    // 🔍 Hunter.io - Buscar email por domínio
    if (!email && hunterKey && profile.website) {
      try {
        const domain = new URL(profile.website).hostname.replace('www.', '');
        console.log(`🔍 Buscando email no Hunter.io para: ${domain}`);
        const hunterResponse = await fetch(`https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${hunterKey}&limit=1`);
        const hunterData = await hunterResponse.json();
        if (hunterData.data?.emails?.[0]) {
          email = hunterData.data.emails[0].value;
          console.log(`✅ Email encontrado via Hunter.io: ${email}`);
        }
      } catch (e) {
        console.log('⚠️ Hunter.io lookup falhou:', e);
      }
    }

    // ✉️ Abstract API - Validar email
    if (email && abstractEmailKey) {
      try {
        console.log(`✉️ Validando email com Abstract API: ${email}`);
        const validationResponse = await fetch(`https://emailvalidation.abstractapi.com/v1/?api_key=${abstractEmailKey}&email=${email}`);
        const validation = await validationResponse.json();
        if (validation.deliverability === 'UNDELIVERABLE') {
          console.log(`⚠️ Email inválido (não entregável): ${email}`);
          email = null;
        } else {
          console.log(`✅ Email validado: ${email}`);
        }
      } catch (e) {
        console.log('⚠️ Validação de email falhou:', e);
      }
    }

    // 🎯 Retornar dados enriquecidos
    return {
      profile: profileUrl,
      success: true,
      platform: 'instagram',
      name: profile.fullName || profile.username,
      username: profile.username,
      bio: bio,
      phone: phone,
      email: email,
      whatsapp: whatsapp,
      website: profile.website || profile.externalUrl || profile.url,
      category: profile.businessCategoryName || profile.category,
      isVerified: isVerified,
      isBusinessProfile: isBusinessProfile,
      followers: profile.followersCount || profile.followers || 0,
      following: profile.followingCount || profile.following || 0,
      posts: profile.postsCount || profile.posts || 0,
      hasStories: profile.hasStories || false,
      contactButtonText: profile.contactButtonText,
    };
  } catch (error) {
    console.error('❌ Erro no Apify Instagram scraper:', error);
    return {
      profile: profileUrl,
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      platform: 'instagram'
    };
  }
}

// 🚀 APIFY FACEBOOK SCRAPER
async function scrapeFacebookWithApify(
  profileUrl: string, 
  apifyKey: string, 
  hunterKey: string | undefined, 
  abstractEmailKey: string | undefined
) {
  try {
    console.log(`📘 Iniciando Apify Facebook Scraper para: ${profileUrl}`);
    
    const actorResponse = await fetch(`https://api.apify.com/v2/acts/apify~facebook-pages-scraper/runs?token=${apifyKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls: [{ url: profileUrl }],
        maxPosts: 0,
        maxReviews: 0,
      })
    });

    if (!actorResponse.ok) {
      throw new Error(`Apify API error: ${actorResponse.status}`);
    }

    const runData = await actorResponse.json();
    const runId = runData.data.id;
    console.log(`⏳ Apify run iniciado: ${runId}`);

    let attempts = 0;
    let runStatus = 'RUNNING';
    while (runStatus === 'RUNNING' && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const statusResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apifyKey}`);
      const statusData = await statusResponse.json();
      runStatus = statusData.data.status;
      attempts++;
      console.log(`⏳ Status: ${runStatus} (tentativa ${attempts}/30)`);
    }

    if (runStatus !== 'SUCCEEDED') {
      throw new Error(`Apify run falhou com status: ${runStatus}`);
    }

    const resultsResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apifyKey}`);
    const results = await resultsResponse.json();
    
    if (!results || results.length === 0) {
      throw new Error('Nenhum dado retornado do Apify');
    }

    const page = results[0];
    console.log(`✅ Página Facebook extraída: ${page.name}`);

    let phone = page.phone ? formatPhone(page.phone) : null;
    let email = page.email || null;
    let whatsapp = page.whatsapp ? formatPhone(page.whatsapp) : phone;

    // 🔍 Hunter.io para email
    if (!email && hunterKey && page.website) {
      try {
        const domain = new URL(page.website).hostname.replace('www.', '');
        console.log(`🔍 Buscando email no Hunter.io para: ${domain}`);
        const hunterResponse = await fetch(`https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${hunterKey}&limit=1`);
        const hunterData = await hunterResponse.json();
        if (hunterData.data?.emails?.[0]) {
          email = hunterData.data.emails[0].value;
          console.log(`✅ Email encontrado via Hunter.io: ${email}`);
        }
      } catch (e) {
        console.log('⚠️ Hunter.io lookup falhou:', e);
      }
    }

    // ✉️ Validar email
    if (email && abstractEmailKey) {
      try {
        const validationResponse = await fetch(`https://emailvalidation.abstractapi.com/v1/?api_key=${abstractEmailKey}&email=${email}`);
        const validation = await validationResponse.json();
        if (validation.deliverability === 'UNDELIVERABLE') {
          console.log(`⚠️ Email inválido: ${email}`);
          email = null;
        }
      } catch (e) {
        console.log('⚠️ Validação de email falhou:', e);
      }
    }

    return {
      profile: profileUrl,
      success: true,
      platform: 'facebook',
      name: page.name,
      bio: page.about || page.description,
      phone: phone,
      email: email,
      whatsapp: whatsapp,
      website: page.website,
      category: page.categories?.[0] || page.category,
      isVerified: page.verified || false,
      isBusinessProfile: true,
      likes: page.likes || 0,
      followers: page.followers || page.likes || 0,
      checkIns: page.checkIns || 0,
    };
  } catch (error) {
    console.error('❌ Erro no Apify Facebook scraper:', error);
    return {
      profile: profileUrl,
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      platform: 'facebook'
    };
  }
}

// 🛠️ UTILITY FUNCTIONS
function formatPhone(phone: string): string {
  if (!phone) return '';
  
  const cleaned = phone.replace(/\D/g, '');
  
  // Já tem código do país
  if (cleaned.startsWith('55') && (cleaned.length === 12 || cleaned.length === 13)) {
    return cleaned;
  }
  
  // Número brasileiro sem código do país
  if (cleaned.length === 10 || cleaned.length === 11) {
    return '55' + cleaned;
  }
  
  return cleaned;
}

function checkIfMobile(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  
  // Número brasileiro móvel: 55 + DDD (2 dígitos) + 9 + 8 dígitos
  if (cleaned.startsWith('55') && cleaned.length === 13) {
    const ninthDigit = cleaned[4];
    return ninthDigit === '9';
  }
  
  // Número sem código do país
  if (cleaned.length === 11) {
    const thirdDigit = cleaned[2];
    return thirdDigit === '9';
  }
  
  return false;
}