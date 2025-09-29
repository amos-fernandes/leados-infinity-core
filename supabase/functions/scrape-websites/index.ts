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
    const { websites, userId, campaignId } = await req.json();
    
    if (!websites || !Array.isArray(websites) || !userId) {
      return new Response(JSON.stringify({ 
        error: 'Parâmetros obrigatórios: websites (array), userId' 
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

    console.log('Scraping websites for WhatsApp contacts:', websites);

    const results = [];
    const savedLeads = [];

    for (const website of websites.slice(0, 10)) { // Limitar a 10 sites por vez
      try {
        const contactData = await scrapeWebsiteForContacts(website, scrapingBeeApiKey);
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
                .eq('website', website)
                .limit(1);

              if (existing && existing.length > 0) {
                console.log('Lead já existe para site:', website);
                continue;
              }

              // Inserir novo lead
              const { data: newLead, error } = await supabase
                .from('leads')
                .insert({
                  user_id: userId,
                  empresa: contact.companyName || extractDomainName(website),
                  telefone: contact.phone,
                  whatsapp: contact.whatsapp,
                  email: contact.email,
                  website: website,
                  status: 'novo',
                  gancho_prospeccao: `Contato encontrado no site: ${contact.source}`,
                })
                .select()
                .single();

              if (error) {
                console.error('Erro ao salvar lead do site:', error);
                continue;
              }

              savedLeads.push(newLead);

              // Registrar na base de conhecimento
              await supabase
                .from('campaign_knowledge')
                .insert({
                  user_id: userId,
                  campaign_id: campaignId,
                  content: `Lead coletado do site ${website}: ${contact.companyName || 'Empresa'} - WhatsApp: ${contact.whatsapp || 'N/A'}`,
                  knowledge_type: 'website_scraping',
                  generated_at: new Date().toISOString()
                });

            } catch (leadError) {
              console.error('Erro ao processar lead do site:', leadError);
            }
          }
        }

      } catch (siteError) {
        console.error(`Erro ao fazer scraping do site ${website}:`, siteError);
        results.push({
          website,
          success: false,
          error: siteError instanceof Error ? siteError.message : 'Erro desconhecido',
          contacts: []
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `${savedLeads.length} novos leads coletados de ${websites.length} sites`,
      leads: savedLeads,
      scrapingResults: results,
      totalWebsites: websites.length,
      processedWebsites: results.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error scraping websites:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function scrapeWebsiteForContacts(website: string, apiKey: string) {
  const contactPages = ['', '/contato', '/sobre', '/contact', '/about', '/fale-conosco'];
  const contacts: any[] = [];
  
  for (const page of contactPages) {
    try {
      const fullUrl = `${website}${page}`;
      
      const scrapingUrl = new URL('https://app.scrapingbee.com/api/v1/');
      scrapingUrl.searchParams.append('api_key', apiKey);
      scrapingUrl.searchParams.append('url', fullUrl);
      scrapingUrl.searchParams.append('render_js', 'true');
      scrapingUrl.searchParams.append('wait', '2000');

      const response = await fetch(scrapingUrl.toString());
      
      if (!response.ok) {
        console.log(`Erro ao acessar ${fullUrl}: ${response.status}`);
        continue;
      }

      const html = await response.text();
      const extractedContacts = extractContactsFromHTML(html, fullUrl);
      
      contacts.push(...extractedContacts);
      
      // Pequena pausa entre requisições
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (pageError) {
      console.error(`Erro ao processar página ${page}:`, pageError);
    }
  }

  return {
    website,
    success: true,
    contacts: removeDuplicateContacts(contacts),
    pagesScraped: contactPages.length
  };
}

function extractContactsFromHTML(html: string, source: string) {
  const contacts: any[] = [];
  
  try {
    // Regex para WhatsApp
    const whatsappRegex = /(api\.whatsapp\.com\/send\?phone=|wa\.me\/)(\+?55)?(\d{10,11})/gi;
    const phoneRegex = /(\+55\s?\(?1[1-9]\)?\s?\d{4,5}-?\d{4}|\+55\s?\(?[1-9][1-9]\)?\s?\d{4,5}-?\d{4}|1[1-9]\s?\d{4,5}-?\d{4}|[1-9][1-9]\s?\d{4,5}-?\d{4})/g;
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    
    // Extrair nome da empresa do title ou h1
    const companyNameMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i) || html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const companyName = companyNameMatch ? companyNameMatch[1].trim() : null;

    // Buscar links de WhatsApp
    let whatsappMatch;
    while ((whatsappMatch = whatsappRegex.exec(html)) !== null) {
      const phone = whatsappMatch[3];
      if (phone) {
        contacts.push({
          companyName,
          whatsapp: formatPhone(phone),
          phone: formatPhone(phone),
          email: null,
          source: source,
          type: 'whatsapp_link'
        });
      }
    }

    // Buscar números de telefone
    const phones = html.match(phoneRegex) || [];
    phones.forEach(phone => {
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        contacts.push({
          companyName,
          phone: formatPhone(cleanPhone),
          whatsapp: checkIfMobile(cleanPhone) ? formatPhone(cleanPhone) : null,
          email: null,
          source: source,
          type: 'phone_number'
        });
      }
    });

    // Buscar emails
    const emails = html.match(emailRegex) || [];
    emails.forEach(email => {
      if (!email.includes('example.com') && !email.includes('domain.com')) {
        contacts.push({
          companyName,
          phone: null,
          whatsapp: null,
          email: email.toLowerCase(),
          source: source,
          type: 'email'
        });
      }
    });

    // Buscar botões flutuantes de WhatsApp no HTML
    const floatingWhatsAppRegex = /whatsapp[^>]*(\d{10,13})/gi;
    let floatingMatch;
    while ((floatingMatch = floatingWhatsAppRegex.exec(html)) !== null) {
      const phone = floatingMatch[1];
      if (phone && phone.length >= 10) {
        contacts.push({
          companyName,
          whatsapp: formatPhone(phone),
          phone: formatPhone(phone),
          email: null,
          source: source,
          type: 'floating_whatsapp'
        });
      }
    }

  } catch (error) {
    console.error('Error extracting contacts from HTML:', error);
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

function extractDomainName(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return domain.replace('www.', '').split('.')[0];
  } catch {
    return 'Empresa';
  }
}

function removeDuplicateContacts(contacts: any[]): any[] {
  const seen = new Set();
  return contacts.filter(contact => {
    const key = `${contact.whatsapp || contact.phone || contact.email}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}