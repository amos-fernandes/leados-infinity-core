import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CnpjEnrichmentRequest {
  cnpj: string;
  leadId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cnpj, leadId }: CnpjEnrichmentRequest = await req.json();
    
    if (!cnpj || !leadId) {
      return new Response(JSON.stringify({ error: 'CNPJ and leadId are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`🏢 Enriquecendo lead ${leadId} com CNPJ: ${cnpj}`);

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Clean CNPJ - remove formatting
    const cleanCnpj = cnpj.replace(/\D/g, '');
    
    if (cleanCnpj.length !== 14) {
      throw new Error('CNPJ deve ter 14 dígitos');
    }

    console.log(`🔍 Consultando dados do CNPJ: ${cleanCnpj}`);

    // Try CnpjJA first (mais completo e atualizado)
    let companyData: any = null;
    
    try {
      console.log('🔍 Tentando CnpjJA...');
      const cnpjJaUrl = `https://api.cnpja.com/office/${cleanCnpj}`;
      const cnpjJaResponse = await fetch(cnpjJaUrl, {
        headers: {
          'Authorization': Deno.env.get('CNPJA_API_KEY') || ''
        }
      });
      
      if (cnpjJaResponse.ok) {
        const data = await cnpjJaResponse.json();
        console.log('✅ Dados obtidos da CnpjJA');
        
        companyData = {
          cnpj: cleanCnpj,
          razao_social: data.company?.name,
          nome_fantasia: data.alias,
          cnae_principal: data.mainActivity?.text,
          codigo_cnae: data.mainActivity?.id,
          situacao: data.status?.text,
          cidade: `${data.address?.city}/${data.address?.state}`,
          uf: data.address?.state,
          capital_social: parseFloat(data.company?.equity) || 0,
          porte: data.company?.size?.text,
          natureza_juridica: data.company?.nature?.text,
          data_abertura: data.founded
        };
      } else {
        throw new Error(`CnpjJA retornou status ${cnpjJaResponse.status}`);
      }
    } catch (cnpjJaError) {
      console.error('❌ Erro na CnpjJA:', (cnpjJaError as Error).message);
      
      // Fallback to BrasilAPI
      try {
        console.log('🔄 Tentando BrasilAPI como fallback...');
        const brasilApiUrl = `https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`;
        const brasilResponse = await fetch(brasilApiUrl);
        
        if (brasilResponse.ok) {
          const data = await brasilResponse.json();
          console.log('✅ Dados obtidos da BrasilAPI');
        
        companyData = {
          cnpj: cleanCnpj,
          razao_social: data.razao_social,
          nome_fantasia: data.nome_fantasia,
          cnae_principal: data.cnae_fiscal_descricao,
          codigo_cnae: data.cnae_fiscal,
          situacao: data.descricao_situacao_cadastral,
          cidade: `${data.municipio}/${data.uf}`,
          uf: data.uf,
          capital_social: parseFloat(data.capital_social) || 0,
          porte: data.porte,
          natureza_juridica: data.natureza_juridica,
          data_abertura: data.data_inicio_atividade
        };
      } else {
        throw new Error(`BrasilAPI retornou status ${brasilResponse.status}`);
      }
      } catch (error) {
        console.error('❌ Erro na BrasilAPI:', (error as Error).message);
        
        // Fallback to ReceitaWS
      try {
        console.log('🔄 Tentando ReceitaWS como fallback...');
        const receitaUrl = `https://www.receitaws.com.br/v1/cnpj/${cleanCnpj}`;
        const receitaResponse = await fetch(receitaUrl);
        
        if (receitaResponse.ok) {
          const data = await receitaResponse.json();
          
          if (data.status === 'OK') {
            console.log('✅ Dados obtidos da ReceitaWS');
            
            companyData = {
              cnpj: cleanCnpj,
              razao_social: data.nome,
              nome_fantasia: data.fantasia,
              cnae_principal: data.atividade_principal?.[0]?.text,
              codigo_cnae: data.atividade_principal?.[0]?.code,
              situacao: data.situacao,
              cidade: `${data.municipio}/${data.uf}`,
              uf: data.uf,
              capital_social: parseFloat(data.capital_social?.replace(/\D/g, '') || '0') / 100,
              porte: data.porte,
              natureza_juridica: data.natureza_juridica,
              data_abertura: data.abertura
            };
          } else {
            throw new Error('CNPJ não encontrado na ReceitaWS');
          }
        } else {
          throw new Error(`ReceitaWS retornou status ${receitaResponse.status}`);
        }
        } catch (receitaError) {
          console.error('❌ Erro na ReceitaWS:', (receitaError as Error).message);
          throw new Error('Não foi possível obter dados do CNPJ em nenhuma API');
        }
    }

    if (!companyData) {
      throw new Error('Nenhum dado foi obtido para o CNPJ');
    }

    // Update lead with enriched data
    console.log('🔄 Atualizando lead com dados enriquecidos...');
    
    const { error: updateError } = await supabase
      .from('leads')
      .update({
        cnpj: companyData.cnpj,
        cnae_principal: companyData.cnae_principal,
        cidade: companyData.cidade,
        uf: companyData.uf,
        capital_social: companyData.capital_social,
        regime_tributario: companyData.porte,
        // Update tech_stack with company data
        tech_stack: {
          ...companyData,
          enrichment_date: new Date().toISOString(),
          source: companyData.cnpj ? 'cnpja_brasil_api_receita_ws' : 'unknown'
        }
      })
      .eq('id', leadId);

    if (updateError) {
      console.error('❌ Erro ao atualizar lead:', updateError);
      throw new Error('Falha ao salvar dados enriquecidos');
    }

    console.log('✅ Lead enriquecido com sucesso!');

    return new Response(JSON.stringify({ 
      success: true,
      data: companyData,
      message: 'Lead enriquecido com dados do CNPJ'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro no enriquecimento CNPJ:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});