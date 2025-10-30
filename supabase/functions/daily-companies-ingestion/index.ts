import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompanyRecord {
  cnpj: string;
  cnpj_raiz?: string;
  razao_social: string;
  nome_fantasia?: string;
  data_abertura: string;
  situacao_cadastral?: string;
  porte?: string;
  mei?: boolean;
  matriz_filial?: string;
  capital_social?: number;
  atividade_principal_codigo?: string;
  atividade_principal_descricao?: string;
  codigo_natureza_juridica?: string;
  descricao_natureza_juridica?: string;
  estado: string;
  cidade?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cep?: string;
  contato_telefonico?: string;
  contato_telefonico_tipo?: string;
  contato_email?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Iniciando ingestão diária de novas empresas...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obter usuário autenticado
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('❌ Erro de autenticação:', userError);
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { companies, fonte, data_referencia } = await req.json();

    if (!companies || !Array.isArray(companies) || companies.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhuma empresa fornecida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Processando ${companies.length} empresas...`);

    const results = {
      success: 0,
      errors: 0,
      anomalias_temporais: 0,
      messages: [] as string[],
      companies_by_state: {} as Record<string, number>
    };

    // Processar cada empresa
    for (const company of companies) {
      try {
        // Validar data de abertura
        const dataAbertura = new Date(company.data_abertura);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        
        const isAnomaliaTempoiral = dataAbertura > hoje;

        if (isAnomaliaTempoiral) {
          results.anomalias_temporais++;
          console.warn(`⚠️ ANOMALIA TEMPORAL detectada: ${company.razao_social} - Data: ${company.data_abertura}`);
        }

        // Preparar dados para inserção
        const companyData = {
          user_id: user.id,
          cnpj: company.cnpj,
          cnpj_raiz: company.cnpj_raiz,
          razao_social: company.razao_social,
          nome_fantasia: company.nome_fantasia,
          data_abertura: company.data_abertura,
          situacao_cadastral: company.situacao_cadastral,
          porte: company.porte,
          mei: company.mei || false,
          matriz_filial: company.matriz_filial,
          capital_social: company.capital_social,
          atividade_principal_codigo: company.atividade_principal_codigo,
          atividade_principal_descricao: company.atividade_principal_descricao,
          codigo_natureza_juridica: company.codigo_natureza_juridica,
          descricao_natureza_juridica: company.descricao_natureza_juridica,
          estado: company.estado,
          cidade: company.cidade,
          logradouro: company.logradouro,
          numero: company.numero,
          bairro: company.bairro,
          cep: company.cep,
          contato_telefonico: company.contato_telefonico,
          contato_telefonico_tipo: company.contato_telefonico_tipo,
          contato_email: company.contato_email,
          fonte_dados: fonte || 'manual',
          anomalia_temporal: isAnomaliaTempoiral,
          anomalia_descricao: isAnomaliaTempoiral ? `Data de abertura futura: ${company.data_abertura}` : null,
          raw_data: company
        };

        // Inserir no banco
        const { error: insertError } = await supabase
          .from('daily_new_companies')
          .insert(companyData);

        if (insertError) {
          console.error(`❌ Erro ao inserir ${company.razao_social}:`, insertError);
          results.errors++;
          results.messages.push(`Erro: ${company.razao_social} - ${insertError.message}`);
        } else {
          results.success++;
          
          // Contabilizar por estado
          if (!results.companies_by_state[company.estado]) {
            results.companies_by_state[company.estado] = 0;
          }
          results.companies_by_state[company.estado]++;
        }
      } catch (error) {
        console.error(`❌ Erro ao processar empresa:`, error);
        results.errors++;
        results.messages.push(`Erro ao processar: ${error.message}`);
      }
    }

    // Atualizar estatísticas agregadas
    if (data_referencia && results.success > 0) {
      for (const [estado, total] of Object.entries(results.companies_by_state)) {
        const statsData = {
          user_id: user.id,
          data_referencia,
          estado,
          total_empresas: total,
          tem_anomalia: results.anomalias_temporais > 0,
          fonte_dados: fonte || 'manual'
        };

        await supabase
          .from('daily_companies_stats')
          .upsert(statsData, {
            onConflict: 'user_id,data_referencia,estado'
          });
      }
    }

    console.log(`✅ Ingestão concluída: ${results.success} sucessos, ${results.errors} erros, ${results.anomalias_temporais} anomalias temporais`);

    return new Response(
      JSON.stringify({
        success: true,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na ingestão:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
