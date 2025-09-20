import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const googleGeminiApiKey = Deno.env.get('GOOGLE_GEMINI_API_KEY');
const agenteVendasApiKey = Deno.env.get('AGENTE_VENDAS_API_KEY');
const agenteVendasUrl = Deno.env.get('AGENTE_VENDAS_URL');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContentRequest {
  leadId: string;
  userId: string;
  contentType: 'linkedin-post' | 'instagram-reel' | 'whatsapp-message' | 'facebook-post';
  leadData?: any;
  customPrompt?: string;
  tone?: 'professional' | 'casual' | 'consultative';
}

const CONTENT_TEMPLATES = {
  'linkedin-post': {
    name: 'Post LinkedIn Corporativo',
    description: 'Post profissional para LinkedIn focado em B2B',
    maxLength: 1300,
    hashtags: true
  },
  'instagram-reel': {
    name: 'Reel Instagram',
    description: 'Script para vídeo curto educativo sobre tributação',
    maxLength: 800,
    hashtags: true
  },
  'whatsapp-message': {
    name: 'Mensagem WhatsApp',
    description: 'Mensagem direta e personalizada para WhatsApp',
    maxLength: 600,
    hashtags: false
  },
  'facebook-post': {
    name: 'Post Facebook',
    description: 'Post para Facebook com engajamento',
    maxLength: 1000,
    hashtags: true
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Content agent function started');
    
    const body = await req.json();
    const { leadId, userId, contentType, leadData, customPrompt, tone = 'consultative' } = body as ContentRequest;

    if (!leadId || !userId || !contentType) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Parâmetros obrigatórios: leadId, userId, contentType'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar dados do lead se não fornecidos
    let lead = leadData;
    if (!lead) {
      const { data: leadFromDB, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .eq('user_id', userId)
        .single();

      if (leadError || !leadFromDB) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Lead não encontrado'
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      lead = leadFromDB;
    }

    // Buscar dados do consultor
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, company')
      .eq('user_id', userId)
      .single();

    const consultorName = profile?.display_name || 'Consultor Tributário';
    const consultorCompany = profile?.company || 'Consultoria Tributária';

    let generatedContent;

    // Tentar usar o agente de vendas externo primeiro
    if (agenteVendasUrl && agenteVendasApiKey) {
      try {
        generatedContent = await callExternalContentAgent({
          leadData: lead,
          contentType,
          consultorName,
          consultorCompany,
          tone,
          customPrompt
        });
      } catch (error) {
        console.log('Agente de vendas externo não disponível, usando IA local:', error.message);
        generatedContent = null;
      }
    }

    // Se agente externo falhou ou não está disponível, usar IA local
    if (!generatedContent) {
      if (!googleGeminiApiKey) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Nem agente de vendas externo nem Google Gemini API estão configurados'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      generatedContent = await generateContentWithAI({
        leadData: lead,
        contentType,
        consultorName,
        consultorCompany,
        tone,
        customPrompt
      });
    }

    // Salvar conteúdo gerado no banco
    const contentData = {
      user_id: userId,
      lead_id: leadId,
      content_type: contentType,
      content: generatedContent.content,
      platform: contentType.split('-')[0],
      status: 'gerado',
      metadata: {
        tone,
        lead_sector: lead.setor,
        generated_by: generatedContent.generatedBy || 'ai-local'
      },
      created_at: new Date().toISOString()
    };

    const { data: savedContent, error: saveError } = await supabase
      .from('generated_content')
      .insert(contentData)
      .select()
      .single();

    if (saveError) {
      console.error('Erro ao salvar conteúdo:', saveError);
      await createGeneratedContentTable(supabase);
      
      // Tentar salvar novamente
      const { data: retryContent, error: retryError } = await supabase
        .from('generated_content')
        .insert(contentData)
        .select()
        .single();
        
      if (retryError) {
        console.log('Continuando sem salvar no banco...');
      }
    }

    // Registrar interação no CRM
    await supabase
      .from('interactions')
      .insert({
        user_id: userId,
        contact_id: leadId,
        tipo: 'conteudo_gerado',
        assunto: `Conteúdo ${contentType} gerado`,
        descricao: `Conteúdo para ${contentType} gerado automaticamente para ${lead.empresa}`,
        data_interacao: new Date().toISOString()
      });

    console.log(`Conteúdo ${contentType} gerado com sucesso para lead ${leadId}`);

    return new Response(JSON.stringify({
      success: true,
      message: `Conteúdo ${contentType} gerado com sucesso!`,
      content: generatedContent.content,
      contentId: savedContent?.id || `CONTENT-${Date.now()}`,
      contentType,
      metadata: {
        leadName: lead.empresa,
        platform: contentType.split('-')[0],
        generatedBy: generatedContent.generatedBy || 'ai-local',
        tone
      },
      usage: generatedContent.usage || null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in content-agent function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function callExternalContentAgent(params: any) {
  const { leadData, contentType, consultorName, consultorCompany, tone, customPrompt } = params;

  const payload = {
    topic: customPrompt || `Consultoria tributária para ${leadData.setor} - ${leadData.empresa}`,
    lead_info: {
      empresa: leadData.empresa,
      setor: leadData.setor,
      regime_tributario: leadData.regime_tributario,
      contato: leadData.contato_decisor
    },
    platform: contentType,
    cta: "Descubra como otimizar sua carga tributária: Fale com nossos especialistas!",
    tone: tone,
    consultant: {
      name: consultorName,
      company: consultorCompany
    }
  };

  let endpoint;
  switch (contentType) {
    case 'linkedin-post':
      endpoint = '/generate-linkedin-post';
      break;
    case 'instagram-reel':
      endpoint = '/generate-reel';
      break;
    case 'whatsapp-message':
      endpoint = '/generate-whatsapp-message';
      break;
    case 'facebook-post':
      endpoint = '/generate-facebook-post';
      break;
    default:
      throw new Error(`Tipo de conteúdo não suportado: ${contentType}`);
  }

  const response = await fetch(`${agenteVendasUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${agenteVendasApiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Agente de vendas retornou erro: ${response.status}`);
  }

  const result = await response.json();
  
  return {
    content: result.content || result.generated_content,
    generatedBy: 'agente-vendas-externo',
    usage: result.usage
  };
}

async function generateContentWithAI(params: any) {
  const { leadData, contentType, consultorName, consultorCompany, tone, customPrompt } = params;
  
  const template = CONTENT_TEMPLATES[contentType as keyof typeof CONTENT_TEMPLATES];
  
  const prompt = `Você é um especialista em marketing digital e consultoria tributária.

Gere um ${template.name} de alta qualidade para engajar um lead B2B.

**DADOS DO LEAD:**
- Empresa: ${leadData.empresa}
- Setor: ${leadData.setor || 'Empresarial'}
- Regime Tributário: ${leadData.regime_tributario || 'A definir'}
- Contato: ${leadData.contato_decisor || 'Decisor'}

**CONSULTOR:** ${consultorName}
**EMPRESA:** ${consultorCompany}

**TIPO DE CONTEÚDO:** ${template.description}
**TOM:** ${tone === 'professional' ? 'Profissional e técnico' : tone === 'casual' ? 'Descontraído e acessível' : 'Consultivo e educativo'}
**LIMITE:** Máximo ${template.maxLength} caracteres
**HASHTAGS:** ${template.hashtags ? 'Incluir hashtags relevantes' : 'Sem hashtags'}

${customPrompt ? `**PROMPT PERSONALIZADO:** ${customPrompt}` : ''}

**DIRETRIZES ESPECÍFICAS:**

${contentType === 'linkedin-post' ? `
- Foco em insights do setor ${leadData.setor}
- Call-to-action profissional
- Mencionar benefícios tangíveis
- Usar storytelling corporativo
` : ''}

${contentType === 'instagram-reel' ? `
- Script para vídeo de 15-30 segundos
- Linguagem dinâmica e visual
- Hook forte nos primeiros 3 segundos
- CTA claro no final
` : ''}

${contentType === 'whatsapp-message' ? `
- Mensagem direta e personalizada
- Sem formalidades excessivas
- Call-to-action claro
- Emojis estratégicos
` : ''}

${contentType === 'facebook-post' ? `
- Engajamento e compartilhamento
- Educativo com dicas práticas
- Linguagem acessível
- CTA para interação
` : ''}

**CONTEXTO TRIBUTÁRIO:**
- Focar em oportunidades de economia fiscal
- Mencionar recuperação de créditos se relevante
- Destacar compliance e segurança jurídica
- ROI e benefícios mensuráveis

Gere apenas o conteúdo solicitado, sem explicações adicionais.`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleGeminiApiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 1500
      }
    }),
  });

  if (!response.ok) {
    throw new Error(`Erro na API do Gemini: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
    return {
      content: data.candidates[0].content.parts[0].text,
      generatedBy: 'ai-local'
    };
  } else {
    throw new Error('Resposta inválida da IA');
  }
}

async function createGeneratedContentTable(supabase: any) {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS generated_content (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL,
      lead_id UUID,
      content_type TEXT NOT NULL,
      content TEXT NOT NULL,
      platform TEXT NOT NULL,
      status TEXT DEFAULT 'gerado',
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
    
    ALTER TABLE generated_content ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Users can manage their own content" 
    ON generated_content FOR ALL 
    USING (auth.uid() = user_id);
  `;
  
  try {
    await supabase.rpc('exec', { sql: createTableSQL });
  } catch (error) {
    console.log('Tabela generated_content já existe ou erro na criação:', error);
  }
}