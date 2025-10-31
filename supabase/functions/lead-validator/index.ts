import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QualificationCriteria {
  requiredCnaes?: string[];   // Lista de CNAEs que qualificam o lead
  requiredUfs?: string[];     // Lista de estados (UFs)
  minCapitalSocial?: number;  // Capital social mínimo
  maxCapitalSocial?: number;  // Capital social máximo
  requiredRegimeTributario?: string[]; // Porte da empresa
  excludedSituacoes?: string[]; // Situações que desqualificam
}

interface ValidateLeadRequest {
  leadId: string;
  criteria: QualificationCriteria;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId, criteria }: ValidateLeadRequest = await req.json();
    
    if (!leadId || !criteria) {
      return new Response(JSON.stringify({ error: 'leadId and criteria are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`🎯 Validando qualificação do lead: ${leadId}`);

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get lead data
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      throw new Error(`Lead não encontrado: ${leadError?.message}`);
    }

    console.log(`📊 Analisando lead: ${lead.empresa}`);

    let qualificationScore = 0;
    let maxScore = 0;
    const validationResults: string[] = [];
    let isQualified = true;

    // Validate CNAE (Required)
    if (criteria.requiredCnaes && criteria.requiredCnaes.length > 0) {
      maxScore += 30; // 30% weight for CNAE
      
      if (lead.tech_stack?.codigo_cnae) {
        const leadCnae = lead.tech_stack.codigo_cnae.toString();
        const matchesCnae = criteria.requiredCnaes.some(cnae => 
          leadCnae.startsWith(cnae) || leadCnae === cnae
        );
        
        if (matchesCnae) {
          qualificationScore += 30;
          validationResults.push(`✅ CNAE qualificado: ${leadCnae}`);
        } else {
          isQualified = false;
          validationResults.push(`❌ CNAE não qualificado: ${leadCnae} (requerido: ${criteria.requiredCnaes.join(', ')})`);
        }
      } else {
        isQualified = false;
        validationResults.push(`❌ CNAE não encontrado nos dados do lead`);
      }
    }

    // Validate UF (State)
    if (criteria.requiredUfs && criteria.requiredUfs.length > 0) {
      maxScore += 20; // 20% weight for location
      
      if (lead.uf) {
        if (criteria.requiredUfs.includes(lead.uf)) {
          qualificationScore += 20;
          validationResults.push(`✅ Localização qualificada: ${lead.uf}`);
        } else {
          isQualified = false;
          validationResults.push(`❌ UF não qualificada: ${lead.uf} (requeridas: ${criteria.requiredUfs.join(', ')})`);
        }
      } else {
        isQualified = false;
        validationResults.push(`❌ UF não encontrada nos dados do lead`);
      }
    }

    // Validate Capital Social
    if (criteria.minCapitalSocial || criteria.maxCapitalSocial) {
      maxScore += 15; // 15% weight for capital
      
      const capitalSocial = lead.capital_social || 0;
      let capitalOk = true;
      
      if (criteria.minCapitalSocial && capitalSocial < criteria.minCapitalSocial) {
        capitalOk = false;
        validationResults.push(`❌ Capital social muito baixo: R$ ${capitalSocial} (mínimo: R$ ${criteria.minCapitalSocial})`);
      }
      
      if (criteria.maxCapitalSocial && capitalSocial > criteria.maxCapitalSocial) {
        capitalOk = false;
        validationResults.push(`❌ Capital social muito alto: R$ ${capitalSocial} (máximo: R$ ${criteria.maxCapitalSocial})`);
      }
      
      if (capitalOk) {
        qualificationScore += 15;
        validationResults.push(`✅ Capital social adequado: R$ ${capitalSocial}`);
      } else {
        isQualified = false;
      }
    }

    // Validate Company Size (Regime Tributário/Porte)
    if (criteria.requiredRegimeTributario && criteria.requiredRegimeTributario.length > 0) {
      maxScore += 15; // 15% weight for company size
      
      if (lead.regime_tributario) {
        if (criteria.requiredRegimeTributario.includes(lead.regime_tributario)) {
          qualificationScore += 15;
          validationResults.push(`✅ Porte da empresa qualificado: ${lead.regime_tributario}`);
        } else {
          isQualified = false;
          validationResults.push(`❌ Porte não qualificado: ${lead.regime_tributario} (requeridos: ${criteria.requiredRegimeTributario.join(', ')})`);
        }
      } else {
        validationResults.push(`⚠️ Porte da empresa não informado`);
      }
    }

    // Check for excluded situations
    if (criteria.excludedSituacoes && criteria.excludedSituacoes.length > 0) {
      maxScore += 10; // 10% weight for company status
      
      const situacao = lead.tech_stack?.situacao || '';
      const isExcluded = criteria.excludedSituacoes.some(excluded => 
        situacao.toLowerCase().includes(excluded.toLowerCase())
      );
      
      if (isExcluded) {
        isQualified = false;
        validationResults.push(`❌ Situação excluída: ${situacao}`);
      } else {
        qualificationScore += 10;
        validationResults.push(`✅ Situação adequada: ${situacao}`);
      }
    }

    // Additional quality checks
    maxScore += 10; // 10% for data completeness
    let dataCompleteness = 0;
    
    if (lead.email) dataCompleteness += 3;
    if (lead.telefone || lead.whatsapp) dataCompleteness += 3;
    if (lead.website) dataCompleteness += 2;
    if (lead.cnpj) dataCompleteness += 2;
    
    qualificationScore += dataCompleteness;
    validationResults.push(`📊 Completude dos dados: ${dataCompleteness}/10 pontos`);

    // Calculate final score percentage
    const finalScore = maxScore > 0 ? Math.round((qualificationScore / maxScore) * 100) : 0;
    
    // Update lead with qualification results
    const newStatus = isQualified && finalScore >= 70 ? 'qualificado' : 'desqualificado';
    
    console.log(`📋 Resultado da qualificação: ${newStatus} (${finalScore}%)`);

    const { error: updateError } = await supabase
      .from('leads')
      .update({
        status: newStatus,
        pontuacao_qualificacao: finalScore,
        data_qualificacao: new Date().toISOString(),
        // Store validation results in tech_stack
        tech_stack: {
          ...lead.tech_stack,
          qualification_results: validationResults,
          qualification_criteria: criteria,
          qualification_date: new Date().toISOString()
        }
      })
      .eq('id', leadId);

    if (updateError) {
      console.error('❌ Erro ao atualizar status do lead:', updateError);
      throw new Error('Falha ao salvar resultado da qualificação');
    }

    const result = {
      leadId,
      qualified: isQualified && finalScore >= 70,
      status: newStatus,
      score: finalScore,
      maxScore,
      results: validationResults,
      lead: {
        empresa: lead.empresa,
        cnae: lead.tech_stack?.codigo_cnae,
        uf: lead.uf,
        capital_social: lead.capital_social
      }
    };

    console.log(`✅ Qualificação concluída para ${lead.empresa}: ${newStatus} (${finalScore}%)`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro na validação do lead:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});