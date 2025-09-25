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

    console.log(`Scraping ${platform} profiles:`, profiles);

    const results = [];
    const savedLeads = [];

    for (const profile of profiles.slice(0, 5)) { // Limitar a 5 perfis por vez
      try {
        let contactData;
        
        if (platform === 'instagram') {
          contactData = await scrapeInstagramProfile(profile, scrapingBeeApiKey);
        } else if (platform === 'facebook') {
          contactData = await scrapeFacebookProfile(profile, scrapingBeeApiKey);
        } else {
          throw new Error('Plataforma não suportada');
        }

        results.push(contactData);

        if (contactData.contacts.length > 0) {
          // Salvar cada contato encontrado como lead
          for (const contact of contactData.contacts) {
            try {
              // Verificar se já existe
              const { data: existing } = await supabase
                .from('leads')
                .select('id')
                .eq('user_id', userId)
                .eq('empresa', contact.profileName)
                .limit(1);

              if (existing && existing.length > 0) {
                console.log('Lead já existe:', contact.profileName);
                continue;
              }

              // Inserir novo lead
              const { data: newLead, error } = await supabase
                .from('leads')
                .insert({
                  user_id: userId,
                  empresa: contact.profileName,
                  telefone: contact.phone,
                  whatsapp: contact.whatsapp,
                  email: contact.email,
                  linkedin: platform === 'instagram' ? contact.instagramUrl : contact.facebookUrl,
                  setor: contact.category || 'Redes Sociais',
                  status: 'novo',
                  gancho_prospeccao: `Perfil comercial encontrado no ${platform}: ${contact.bio}`,
                })
                .select()
                .single();

              if (error) {
                console.error('Erro ao salvar lead das redes sociais:', error);
                continue;
              }

              savedLeads.push(newLead);

              // Registrar na base de conhecimento
              await supabase
                .from('campaign_knowledge')
                .insert({
                  user_id: userId,
                  campaign_id: campaignId,
                  content: `Lead coletado do ${platform}: ${contact.profileName} - WhatsApp: ${contact.whatsapp || 'N/A'}`,
                  knowledge_type: 'social_media_scraping',
                  generated_at: new Date().toISOString()
                });

            } catch (leadError) {
              console.error('Erro ao processar lead das redes sociais:', leadError);
            }
          }
        }

      } catch (profileError) {
        console.error(`Erro ao fazer scraping do perfil ${profile}:`, profileError);
        results.push({
          profile,
          success: false,
          error: profileError instanceof Error ? profileError.message : 'Erro desconhecido',
          contacts: []
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `${savedLeads.length} novos leads coletados do ${platform}`,
      leads: savedLeads,
      scrapingResults: results,
      platform: platform,
      totalProfiles: profiles.length,
      processedProfiles: results.length
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

async function scrapeInstagramProfile(profileUrl: string, apiKey: string) {
  try {
    const scrapingUrl = new URL('https://app.scrapingbee.com/api/v1/');
    scrapingUrl.searchParams.append('api_key', apiKey);
    scrapingUrl.searchParams.append('url', profileUrl);
    scrapingUrl.searchParams.append('render_js', 'true');
    scrapingUrl.searchParams.append('wait', '3000');

    const response = await fetch(scrapingUrl.toString());
    
    if (!response.ok) {
      throw new Error(`Erro ao acessar perfil Instagram: ${response.status}`);
    }

    const html = await response.text();
    const contacts = extractContactsFromInstagram(html, profileUrl);

    return {
      profile: profileUrl,
      success: true,
      contacts: contacts,
      platform: 'instagram'
    };

  } catch (error) {
    throw new Error(`Erro no scraping Instagram: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

async function scrapeFacebookProfile(profileUrl: string, apiKey: string) {
  try {
    const scrapingUrl = new URL('https://app.scrapingbee.com/api/v1/');
    scrapingUrl.searchParams.append('api_key', apiKey);
    scrapingUrl.searchParams.append('url', profileUrl);
    scrapingUrl.searchParams.append('render_js', 'true');
    scrapingUrl.searchParams.append('wait', '3000');

    const response = await fetch(scrapingUrl.toString());
    
    if (!response.ok) {
      throw new Error(`Erro ao acessar perfil Facebook: ${response.status}`);
    }

    const html = await response.text();
    const contacts = extractContactsFromFacebook(html, profileUrl);

    return {
      profile: profileUrl,
      success: true,
      contacts: contacts,
      platform: 'facebook'
    };

  } catch (error) {
    throw new Error(`Erro no scraping Facebook: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

function extractContactsFromInstagram(html: string, profileUrl: string) {
  const contacts: any[] = [];

  try {
    // Extrair nome do perfil
    const profileNameMatch = html.match(/<title[^>]*>([^@]+)(@[^)]+)?\s*\([^)]*\)\s*•\s*Instagram/i);
    const profileName = profileNameMatch ? profileNameMatch[1].trim() : 'Perfil Instagram';

    // Extrair bio
    const bioMatch = html.match(/"biography":"([^"]+)"/);
    const bio = bioMatch ? bioMatch[1].replace(/\\n/g, ' ').replace(/\\"/g, '"') : '';

    // Buscar números WhatsApp na bio
    const whatsappRegex = /(api\.whatsapp\.com\/send\?phone=|wa\.me\/)(\+?55)?(\d{10,11})/gi;
    const phoneRegex = /(\+55\s?\(?1[1-9]\)?\s?\d{4,5}-?\d{4}|\+55\s?\(?[1-9][1-9]\)?\s?\d{4,5}-?\d{4}|1[1-9]\s?\d{4,5}-?\d{4}|[1-9][1-9]\s?\d{4,5}-?\d{4})/g;
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

    // WhatsApp links
    let whatsappMatch;
    while ((whatsappMatch = whatsappRegex.exec(bio)) !== null) {
      const phone = whatsappMatch[3];
      if (phone) {
        contacts.push({
          profileName,
          bio,
          whatsapp: formatPhone(phone),
          phone: formatPhone(phone),
          email: null,
          instagramUrl: profileUrl,
          category: 'Instagram Business',
          type: 'whatsapp_instagram'
        });
      }
    }

    // Números de telefone
    const phones = bio.match(phoneRegex) || [];
    phones.forEach(phone => {
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        contacts.push({
          profileName,
          bio,
          phone: formatPhone(cleanPhone),
          whatsapp: checkIfMobile(cleanPhone) ? formatPhone(cleanPhone) : null,
          email: null,
          instagramUrl: profileUrl,
          category: 'Instagram Business',
          type: 'phone_instagram'
        });
      }
    });

    // Emails
    const emails = bio.match(emailRegex) || [];
    emails.forEach(email => {
      contacts.push({
        profileName,
        bio,
        phone: null,
        whatsapp: null,
        email: email.toLowerCase(),
        instagramUrl: profileUrl,
        category: 'Instagram Business',
        type: 'email_instagram'
      });
    });

    // Se não encontrou contatos mas é um perfil business, adicionar pelo menos o perfil
    if (contacts.length === 0 && (bio.includes('business') || bio.includes('empresa') || bio.includes('loja'))) {
      contacts.push({
        profileName,
        bio,
        phone: null,
        whatsapp: null,
        email: null,
        instagramUrl: profileUrl,
        category: 'Instagram Business',
        type: 'profile_instagram'
      });
    }

  } catch (error) {
    console.error('Erro ao extrair dados do Instagram:', error);
  }

  return contacts;
}

function extractContactsFromFacebook(html: string, profileUrl: string) {
  const contacts: any[] = [];

  try {
    // Extrair nome da página
    const pageNameMatch = html.match(/<title[^>]*>([^|]+)/i);
    const profileName = pageNameMatch ? pageNameMatch[1].trim() : 'Página Facebook';

    // Buscar informações de contato
    const phoneRegex = /(\+55\s?\(?1[1-9]\)?\s?\d{4,5}-?\d{4}|\+55\s?\(?[1-9][1-9]\)?\s?\d{4,5}-?\d{4}|1[1-9]\s?\d{4,5}-?\d{4}|[1-9][1-9]\s?\d{4,5}-?\d{4})/g;
    const whatsappRegex = /(api\.whatsapp\.com\/send\?phone=|wa\.me\/)(\+?55)?(\d{10,11})/gi;
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

    // Buscar na seção "About" ou descrição
    const aboutMatch = html.match(/"about":"([^"]+)"/);
    const about = aboutMatch ? aboutMatch[1].replace(/\\n/g, ' ').replace(/\\"/g, '"') : '';

    // WhatsApp
    let whatsappMatch;
    while ((whatsappMatch = whatsappRegex.exec(html)) !== null) {
      const phone = whatsappMatch[3];
      if (phone) {
        contacts.push({
          profileName,
          bio: about,
          whatsapp: formatPhone(phone),
          phone: formatPhone(phone),
          email: null,
          facebookUrl: profileUrl,
          category: 'Facebook Business',
          type: 'whatsapp_facebook'
        });
      }
    }

    // Telefones
    const phones = html.match(phoneRegex) || [];
    phones.forEach(phone => {
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        contacts.push({
          profileName,
          bio: about,
          phone: formatPhone(cleanPhone),
          whatsapp: checkIfMobile(cleanPhone) ? formatPhone(cleanPhone) : null,
          email: null,
          facebookUrl: profileUrl,
          category: 'Facebook Business',
          type: 'phone_facebook'
        });
      }
    });

    // Emails
    const emails = html.match(emailRegex) || [];
    emails.forEach(email => {
      contacts.push({
        profileName,
        bio: about,
        phone: null,
        whatsapp: null,
        email: email.toLowerCase(),
        facebookUrl: profileUrl,
        category: 'Facebook Business',
        type: 'email_facebook'
      });
    });

  } catch (error) {
    console.error('Erro ao extrair dados do Facebook:', error);
  }

  return contacts;
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

function checkIfMobile(phone: string): boolean {
  const clean = phone.replace(/\D/g, '');
  // Verificar se é número móvel brasileiro (9 como primeiro dígito após o DDD)
  if (clean.length >= 10) {
    const dddIndex = clean.length === 11 ? 2 : (clean.length === 10 ? 2 : -1);
    if (dddIndex >= 0 && clean.charAt(dddIndex) === '9') {
      return true;
    }
  }
  return false;
}