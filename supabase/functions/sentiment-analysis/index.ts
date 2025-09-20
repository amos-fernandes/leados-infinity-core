import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const googleGeminiApiKey = Deno.env.get('GOOGLE_GEMINI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SentimentRequest {
  message: string;
  userId: string;
  leadId?: string;
  conversationHistory?: string[];
}

interface SentimentResult {
  sentiment: 'positive' | 'neutral' | 'negative' | 'frustrated' | 'urgent';
  confidence: number;
  emotions: string[];
  urgency_level: 'low' | 'medium' | 'high' | 'critical';
  redirect_to_human: boolean;
  reasoning: string;
  suggested_response_tone: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Sentiment analysis function started');
    
    const body = await req.json();
    const { message, userId, leadId, conversationHistory = [] } = body as SentimentRequest;

    if (!message || !userId) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Parâmetros obrigatórios: message, userId'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Primeiro, análise rápida com padrões básicos
    const quickAnalysis = performQuickSentimentAnalysis(message, conversationHistory);
    
    let aiAnalysis: SentimentResult | null = null;

    // Se há sinais de frustração ou urgência, usar IA para análise mais profunda
    if (quickAnalysis.redirect_to_human || quickAnalysis.urgency_level === 'high' || quickAnalysis.urgency_level === 'critical') {
      if (googleGeminiApiKey) {
        try {
          aiAnalysis = await performAISentimentAnalysis(message, conversationHistory);
        } catch (error) {
          console.error('Erro na análise de IA:', error);
          // Continuar com análise rápida
        }
      }
    }

    const finalAnalysis = aiAnalysis || quickAnalysis;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Salvar análise no banco para tracking
    const analysisData = {
      user_id: userId,
      lead_id: leadId,
      message_analyzed: message.substring(0, 500),
      sentiment: finalAnalysis.sentiment,
      confidence: finalAnalysis.confidence,
      emotions: finalAnalysis.emotions,
      urgency_level: finalAnalysis.urgency_level,
      redirect_to_human: finalAnalysis.redirect_to_human,
      reasoning: finalAnalysis.reasoning,
      analysis_type: aiAnalysis ? 'ai' : 'pattern',
      created_at: new Date().toISOString()
    };

    const { data: savedAnalysis, error: saveError } = await supabase
      .from('sentiment_analysis')
      .insert(analysisData)
      .select()
      .single();

    if (saveError) {
      console.error('Erro ao salvar análise:', saveError);
      await createSentimentAnalysisTable(supabase);
      
      // Tentar salvar novamente
      const { data: retryAnalysis, error: retryError } = await supabase
        .from('sentiment_analysis')
        .insert(analysisData)
        .select()
        .single();
        
      if (retryError) {
        console.log('Continuando sem salvar no banco...');
      }
    }

    // Se deve redirecionar para humano, criar notificação
    if (finalAnalysis.redirect_to_human) {
      await createHumanRedirectNotification(supabase, userId, leadId, message, finalAnalysis);
    }

    console.log(`Análise de sentimento concluída: ${finalAnalysis.sentiment} (${finalAnalysis.confidence})`);

    return new Response(JSON.stringify({
      success: true,
      analysis: finalAnalysis,
      analysisId: savedAnalysis?.id || `SENT-${Date.now()}`,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in sentiment-analysis function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function performQuickSentimentAnalysis(message: string, history: string[]): SentimentResult {
  const lowerMessage = message.toLowerCase();
  
  // Palavras-chave para diferentes sentimentos
  const frustrationKeywords = [
    'não entendi', 'confuso', 'complicado', 'difícil', 'problema', 'erro',
    'não funciona', 'ruim', 'péssimo', 'horrível', 'irritado', 'chateado',
    'não resolve', 'demora', 'lento', 'travou', 'bugou'
  ];

  const urgencyKeywords = [
    'urgente', 'rápido', 'agora', 'hoje', 'pressa', 'emergência',
    'importante', 'preciso já', 'imediato', 'asap', 'emergency'
  ];

  const humanRequestKeywords = [
    'falar com humano', 'atendente', 'pessoa', 'operador', 'consultor',
    'não é bot', 'quero falar com alguém', 'preciso de ajuda', 'suporte humano'
  ];

  const positiveKeywords = [
    'obrigado', 'thanks', 'ótimo', 'excelente', 'perfeito', 'bom',
    'gostei', 'adorei', 'fantástico', 'maravilhoso', 'legal'
  ];

  const negativeKeywords = [
    'não', 'nunca', 'impossível', 'difícil', 'complicado', 'ruim',
    'péssimo', 'horrível', 'odeio', 'detesto', 'terrível'
  ];

  // Contadores
  let frustrationScore = 0;
  let urgencyScore = 0;
  let humanRequestScore = 0;
  let positiveScore = 0;
  let negativeScore = 0;

  // Análise de palavras-chave
  frustrationKeywords.forEach(keyword => {
    if (lowerMessage.includes(keyword)) frustrationScore++;
  });

  urgencyKeywords.forEach(keyword => {
    if (lowerMessage.includes(keyword)) urgencyScore++;
  });

  humanRequestKeywords.forEach(keyword => {
    if (lowerMessage.includes(keyword)) humanRequestScore++;
  });

  positiveKeywords.forEach(keyword => {
    if (lowerMessage.includes(keyword)) positiveScore++;
  });

  negativeKeywords.forEach(keyword => {
    if (lowerMessage.includes(keyword)) negativeScore++;
  });

  // Análise de histórico - muitas mensagens seguidas pode indicar frustração
  const recentMessages = history.slice(-5);
  const repetitivePatterns = recentMessages.filter(msg => 
    msg.toLowerCase().includes('não entendi') || 
    msg.toLowerCase().includes('não funciona')
  ).length;

  // Determinar sentimento principal
  let sentiment: SentimentResult['sentiment'] = 'neutral';
  let confidence = 0.5;
  let emotions: string[] = [];
  let urgency_level: SentimentResult['urgency_level'] = 'low';
  let redirect_to_human = false;

  // Lógica de decisão
  if (humanRequestScore > 0) {
    redirect_to_human = true;
    emotions.push('solicita_humano');
    urgency_level = 'high';
    confidence = 0.9;
  }

  if (frustrationScore > 0 || repetitivePatterns > 2) {
    sentiment = 'frustrated';
    emotions.push('frustração');
    urgency_level = frustrationScore > 2 ? 'critical' : 'high';
    redirect_to_human = true;
    confidence = Math.min(0.8 + (frustrationScore * 0.1), 0.95);
  }

  if (urgencyScore > 0) {
    emotions.push('urgência');
    urgency_level = urgencyScore > 2 ? 'critical' : urgencyScore > 1 ? 'high' : 'medium';
    confidence = Math.max(confidence, 0.7);
  }

  if (positiveScore > negativeScore && sentiment === 'neutral') {
    sentiment = 'positive';
    emotions.push('satisfação');
    confidence = 0.7;
  } else if (negativeScore > positiveScore && sentiment === 'neutral') {
    sentiment = 'negative';
    emotions.push('insatisfação');
    confidence = 0.7;
  }

  // Patterns específicos que indicam necessidade de humano
  const complexityPatterns = [
    /não consigo entender/i,
    /muito complicado/i,
    /preciso de mais informações/i,
    /isso não resolve meu problema/i
  ];

  if (complexityPatterns.some(pattern => pattern.test(message))) {
    redirect_to_human = true;
    urgency_level = 'high';
    confidence = Math.max(confidence, 0.85);
  }

  const reasoning = `Análise baseada em padrões: frustração(${frustrationScore}), urgência(${urgencyScore}), humano(${humanRequestScore}), positivo(${positiveScore}), negativo(${negativeScore}), repetição(${repetitivePatterns})`;

  const suggested_response_tone = sentiment === 'frustrated' ? 'empático e solucionador' :
                                 sentiment === 'positive' ? 'entusiasmado e continuativo' :
                                 urgency_level === 'high' ? 'direto e ágil' :
                                 'consultivo e educativo';

  return {
    sentiment,
    confidence,
    emotions,
    urgency_level,
    redirect_to_human,
    reasoning,
    suggested_response_tone
  };
}

async function performAISentimentAnalysis(message: string, history: string[]): Promise<SentimentResult> {
  const historyContext = history.length > 0 ? 
    `\n\nHistórico da conversa (últimas 5 mensagens):\n${history.slice(-5).join('\n')}` : '';

  const prompt = `Você é um especialista em análise de sentimento para atendimento B2B em consultoria tributária.

Analise a seguinte mensagem do cliente e forneça uma análise detalhada:

**MENSAGEM:** "${message}"${historyContext}

**CONTEXTO:** Cliente em processo de consultoria tributária, interagindo via WhatsApp com bot RAG.

Forneça sua análise em formato JSON com exatamente esta estrutura:

{
  "sentiment": "positive|neutral|negative|frustrated|urgent",
  "confidence": 0.0-1.0,
  "emotions": ["array", "de", "emoções", "detectadas"],
  "urgency_level": "low|medium|high|critical",
  "redirect_to_human": true|false,
  "reasoning": "explicação detalhada da análise",
  "suggested_response_tone": "tom sugerido para resposta"
}

**CRITÉRIOS PARA REDIRECIONAMENTO HUMANO:**
- Cliente expressa frustração clara
- Solicita falar com pessoa
- Pergunta muito complexa ou específica
- Demonstra urgência crítica
- Bot não conseguiu resolver após várias tentativas
- Cliente questiona a competência do bot

**TONS DE RESPOSTA SUGERIDOS:**
- "empático e solucionador" - para frustração
- "direto e ágil" - para urgência
- "consultivo e educativo" - para neutro
- "entusiasmado e continuativo" - para positivo

Analise considerando o contexto B2B empresarial e responda APENAS com o JSON válido.`;

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
        temperature: 0.3,
        maxOutputTokens: 800
      }
    }),
  });

  if (!response.ok) {
    throw new Error(`Erro na API do Gemini: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
    const aiResponse = data.candidates[0].content.parts[0].text;
    
    try {
      // Tentar extrair JSON da resposta
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysisResult = JSON.parse(jsonMatch[0]);
        
        // Validar estrutura
        if (analysisResult.sentiment && analysisResult.confidence !== undefined && 
            analysisResult.emotions && analysisResult.urgency_level && 
            analysisResult.redirect_to_human !== undefined) {
          return analysisResult;
        }
      }
      
      throw new Error('Resposta da IA não contém JSON válido');
    } catch (parseError) {
      console.error('Erro ao parsear resposta da IA:', parseError);
      throw new Error('Resposta inválida da IA para análise de sentimento');
    }
  } else {
    throw new Error('Resposta inválida da IA');
  }
}

async function createHumanRedirectNotification(supabase: any, userId: string, leadId: string | undefined, message: string, analysis: SentimentResult) {
  const notificationData = {
    user_id: userId,
    lead_id: leadId,
    type: 'human_redirect',
    priority: analysis.urgency_level,
    title: 'Cliente solicita atendimento humano',
    message: `Cliente demonstra ${analysis.sentiment} e solicita atendimento humano. Mensagem: "${message.substring(0, 200)}..."`,
    metadata: {
      sentiment: analysis.sentiment,
      confidence: analysis.confidence,
      emotions: analysis.emotions,
      original_message: message
    },
    status: 'pending',
    created_at: new Date().toISOString()
  };

  try {
    await supabase
      .from('human_redirect_notifications')
      .insert(notificationData);
  } catch (error) {
    console.error('Erro ao criar notificação:', error);
    await createNotificationsTable(supabase);
    
    // Tentar novamente
    try {
      await supabase
        .from('human_redirect_notifications')
        .insert(notificationData);
    } catch (retryError) {
      console.error('Erro ao criar notificação (retry):', retryError);
    }
  }
}

async function createSentimentAnalysisTable(supabase: any) {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS sentiment_analysis (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL,
      lead_id UUID,
      message_analyzed TEXT NOT NULL,
      sentiment TEXT NOT NULL,
      confidence DECIMAL(3,2) NOT NULL,
      emotions TEXT[],
      urgency_level TEXT NOT NULL,
      redirect_to_human BOOLEAN DEFAULT false,
      reasoning TEXT,
      analysis_type TEXT DEFAULT 'pattern',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
    
    ALTER TABLE sentiment_analysis ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Users can view their own sentiment analysis" 
    ON sentiment_analysis FOR ALL 
    USING (auth.uid() = user_id);
  `;
  
  try {
    await supabase.rpc('exec', { sql: createTableSQL });
  } catch (error) {
    console.log('Tabela sentiment_analysis já existe ou erro na criação:', error);
  }
}

async function createNotificationsTable(supabase: any) {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS human_redirect_notifications (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL,
      lead_id UUID,
      type TEXT DEFAULT 'human_redirect',
      priority TEXT DEFAULT 'medium',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata JSONB,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
    
    ALTER TABLE human_redirect_notifications ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Users can manage their own notifications" 
    ON human_redirect_notifications FOR ALL 
    USING (auth.uid() = user_id);
  `;
  
  try {
    await supabase.rpc('exec', { sql: createTableSQL });
  } catch (error) {
    console.log('Tabela human_redirect_notifications já existe ou erro na criação:', error);
  }
}