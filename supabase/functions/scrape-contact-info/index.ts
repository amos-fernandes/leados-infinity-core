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

interface ContactInfo {
  phones: string[];
  whatsapp: string[];
  emails: string[];
  social: {
    instagram?: string;
    facebook?: string;
    linkedin?: string;
  };
}

function formatPhoneBrazilian(phone: string): string {
  // Remove tudo que não é número
  const numbers = phone.replace(/\D/g, '');
  
  // Se tem 11 dígitos (celular com DDD)
  if (numbers.length === 11) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  }
  // Se tem 10 dígitos (fixo com DDD)
  if (numbers.length === 10) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  }
  
  return phone; // Retorna original se não conseguir formatar
}

function extractContactInfo(html: string, website: string): ContactInfo {
  const contactInfo: ContactInfo = {
    phones: [],
    whatsapp: [],
    emails: [],
    social: {}
  };

  // Extrair telefones de links tel:
  const telRegex = /tel:([+\d\s\-\(\)]+)/gi;
  const telMatches = html.matchAll(telRegex);
  
  for (const match of telMatches) {
    const phone = formatPhoneBrazilian(match[1]);
    if (!contactInfo.phones.includes(phone)) {
      contactInfo.phones.push(phone);
    }
  }

  // Extrair telefones de texto (formato brasileiro)
  const phoneRegex = /\(?\d{2}\)?\s?\d{4,5}[-\s]?\d{4}/g;
  const phoneMatches = html.matchAll(phoneRegex);
  
  for (const match of phoneMatches) {
    const phone = formatPhoneBrazilian(match[0]);
    if (!contactInfo.phones.includes(phone)) {
      contactInfo.phones.push(phone);
    }
  }

  // Extrair WhatsApp
  const whatsappRegex = /(wa\.me\/|whatsapp\.com\/send\?phone=)([+\d]+)/gi;
  const waMatches = html.matchAll(whatsappRegex);
  
  for (const match of waMatches) {
    const whatsapp = formatPhoneBrazilian(match[2]);
    if (!contactInfo.whatsapp.includes(whatsapp)) {
      contactInfo.whatsapp.push(whatsapp);
    }
  }

  // Extrair emails
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const emailMatches = html.matchAll(emailRegex);
  
  for (const match of emailMatches) {
    const email = match[0];
    if (!email.includes('@example.com') && !contactInfo.emails.includes(email)) {
      contactInfo.emails.push(email);
    }
  }

  // Extrair redes sociais
  const instagramRegex = /instagram\.com\/([^\/\s"']+)/gi;
  const facebookRegex = /facebook\.com\/([^\/\s"']+)/gi;
  const linkedinRegex = /linkedin\.com\/company\/([^\/\s"']+)/gi;

  const igMatch = html.match(instagramRegex);
  if (igMatch) contactInfo.social.instagram = igMatch[0];

  const fbMatch = html.match(facebookRegex);
  if (fbMatch) contactInfo.social.facebook = fbMatch[0];

  const liMatch = html.match(linkedinRegex);
  if (liMatch) contactInfo.social.linkedin = liMatch[0];

  return contactInfo;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { website, leadId, userId } = await req.json();

    if (!scrapingBeeApiKey) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'ScrapingBee API key não configurada' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    // Fazer scraping do website
    const scrapingUrl = new URL('https://app.scrapingbee.com/api/v1/');
    scrapingUrl.searchParams.append('api_key', scrapingBeeApiKey);
    scrapingUrl.searchParams.append('url', website);
    scrapingUrl.searchParams.append('render_js', 'true');
    scrapingUrl.searchParams.append('premium_proxy', 'true');
    scrapingUrl.searchParams.append('country_code', 'br');

    const response = await fetch(scrapingUrl.toString());
    
    if (!response.ok) {
      throw new Error(`ScrapingBee API error: ${response.statusText}`);
    }

    const html = await response.text();
    const contactInfo = extractContactInfo(html, website);

    // Atualizar lead no banco de dados se leadId foi fornecido
    if (leadId && userId) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const updateData: any = {};
      
      if (contactInfo.phones.length > 0) {
        updateData.telefone = contactInfo.phones[0];
      }
      
      if (contactInfo.emails.length > 0) {
        updateData.email = contactInfo.emails[0];
      }

      if (contactInfo.whatsapp.length > 0) {
        updateData.whatsapp = contactInfo.whatsapp[0];
      }

      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase
          .from('leads')
          .update(updateData)
          .eq('id', leadId)
          .eq('user_id', userId);

        if (error) {
          console.error('Erro ao atualizar lead:', error);
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      data: contactInfo,
      message: `Encontrados ${contactInfo.phones.length} telefones, ${contactInfo.whatsapp.length} WhatsApp e ${contactInfo.emails.length} emails`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in scrape-contact-info function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Erro interno do servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});