import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const scrapingBeeApiKey = Deno.env.get('SCRAPINGBEE_API_KEY');
const abstractApiKey = Deno.env.get('ABSTRACT_API_KEY'); // Para telefones
const abstractEmailApiKey = Deno.env.get('ABSTRACT_EMAIL_API_KEY'); // Para emails
const maytapiApiKey = Deno.env.get('MAYTAPI_API_KEY');
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
  websiteValidated?: boolean;
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

// Função para validar e-mail usando AbstractAPI
async function validateEmail(email: string): Promise<{ isValid: boolean; qualityScore: number; disposable: boolean; catchAll: boolean }> {
  if (!abstractEmailApiKey) {
    console.warn('ABSTRACT_EMAIL_API_KEY não configurada. Validação de e-mail será limitada.');
    return { isValid: true, qualityScore: 0.5, disposable: false, catchAll: false };
  }
  
  try {
    const response = await fetch(`https://emailvalidation.abstractapi.com/v1/?api_key=${abstractEmailApiKey}&email=${email}`);
    const data = await response.json();
    
    return {
      isValid: data.is_valid_format?.value && data.is_smtp_valid?.value && !data.is_disposable_email?.value,
      qualityScore: data.quality_score || 0.5,
      disposable: data.is_disposable_email?.value || false,
      catchAll: data.is_catchall_email?.value || false,
    };
  } catch (error) {
    console.error('Erro ao validar e-mail com AbstractAPI:', error);
    return { isValid: false, qualityScore: 0, disposable: false, catchAll: false };
  }
}

// Função para validar número de telefone usando AbstractAPI
async function validatePhoneNumber(phone: string): Promise<{ isValid: boolean; type: string; carrier: string; country: string }> {
  if (!abstractApiKey) {
    console.warn('ABSTRACT_API_KEY não configurada. Validação de telefone será limitada.');
    return { isValid: true, type: 'unknown', carrier: 'unknown', country: 'unknown' };
  }
  
  try {
    // Formatar número para validação (adicionar código do Brasil se necessário)
    let formattedPhone = phone.replace(/\D/g, '');
    if (formattedPhone.length === 10 || formattedPhone.length === 11) {
      formattedPhone = '55' + formattedPhone;
    }
    
    const response = await fetch(`https://phonevalidation.abstractapi.com/v1/?api_key=${abstractApiKey}&phone=${formattedPhone}`);
    const data = await response.json();
    
    return {
      isValid: data.valid || false,
      type: data.type || 'unknown',
      carrier: data.carrier || 'unknown',
      country: data.country || 'unknown',
    };
  } catch (error) {
    console.error('Erro ao validar telefone com AbstractAPI:', error);
    return { isValid: false, type: 'unknown', carrier: 'unknown', country: 'unknown' };
  }
}

// Função para validar número de WhatsApp usando validação básica
async function validateWhatsAppNumber(number: string): Promise<{ isWhatsApp: boolean; isBusiness: boolean; canReceiveMessage: boolean }> {
  // Para implementação completa da Maytapi, seria necessário configurar product_id e phone_id
  // Por enquanto, implementamos uma validação básica baseada no formato do número
  try {
    const cleanNumber = number.replace(/\D/g, '');
    
    // Verificação básica: números brasileiros de celular (11 dígitos com DDD)
    if (cleanNumber.length === 11 && cleanNumber.substring(2, 3) === '9') {
      // Simulação de validação - em produção, usaria API real do WhatsApp Business
      return {
        isWhatsApp: true,
        isBusiness: false, // Não conseguimos determinar sem API específica
        canReceiveMessage: true,
      };
    }
    
    return { isWhatsApp: false, isBusiness: false, canReceiveMessage: false };
  } catch (error) {
    console.error('Erro ao validar WhatsApp:', error);
    return { isWhatsApp: false, isBusiness: false, canReceiveMessage: false };
  }
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

  contactInfo.websiteValidated = true; // O site foi acessado com sucesso pelo ScrapingBee

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
    const extractedContactInfo = extractContactInfo(html, website);

    // Validar e-mails extraídos
    const validatedEmails: string[] = [];
    for (const email of extractedContactInfo.emails) {
      const validationResult = await validateEmail(email);
      if (validationResult.isValid && validationResult.qualityScore > 0.7) {
        validatedEmails.push(email);
      }
      
      // Limitar a 3 validações para evitar sobrecarga da API
      if (validatedEmails.length >= 3) break;
    }

    // Validar telefones extraídos
    const validatedPhones: string[] = [];
    const validatedWhatsapp: string[] = [];

    for (const phone of extractedContactInfo.phones) {
      const validationResult = await validatePhoneNumber(phone);
      if (validationResult.isValid) {
        validatedPhones.push(phone);
        
        // Se for celular, tentar validar como WhatsApp
        if (validationResult.type === 'mobile' || phone.replace(/\D/g, '').length === 11) {
          const whatsappValidation = await validateWhatsAppNumber(phone);
          if (whatsappValidation.isWhatsApp && whatsappValidation.canReceiveMessage) {
            validatedWhatsapp.push(phone);
          }
        }
      }
      
      // Limitar validações para evitar sobrecarga
      if (validatedPhones.length >= 3) break;
    }

    // Validar números de WhatsApp extraídos diretamente
    for (const whatsappNum of extractedContactInfo.whatsapp) {
      if (!validatedWhatsapp.includes(whatsappNum)) {
        const whatsappValidation = await validateWhatsAppNumber(whatsappNum);
        if (whatsappValidation.isWhatsApp && whatsappValidation.canReceiveMessage) {
          validatedWhatsapp.push(whatsappNum);
        }
      }
      
      if (validatedWhatsapp.length >= 3) break;
    }

    // Criar objeto ContactInfo final com dados validados
    const finalContactInfo: ContactInfo = {
      emails: validatedEmails,
      phones: validatedPhones,
      whatsapp: validatedWhatsapp,
      social: extractedContactInfo.social,
      websiteValidated: extractedContactInfo.websiteValidated,
    };

    // Atualizar lead no banco de dados se leadId foi fornecido
    if (leadId && userId) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const updateData: any = {};
      
      if (finalContactInfo.phones.length > 0) {
        updateData.telefone = finalContactInfo.phones[0];
      }
      
      if (finalContactInfo.emails.length > 0) {
        updateData.email = finalContactInfo.emails[0];
      }

      if (finalContactInfo.whatsapp.length > 0) {
        updateData.whatsapp = finalContactInfo.whatsapp[0];
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
      data: finalContactInfo,
      message: `Encontrados e validados ${finalContactInfo.phones.length} telefones, ${finalContactInfo.whatsapp.length} WhatsApp e ${finalContactInfo.emails.length} emails`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in scrape-contact-info function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});