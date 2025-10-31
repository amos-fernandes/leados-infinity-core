import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RFB_BASE_URL = 'https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/cadastros/cadastro-nacional-de-pessoas-juridicas-cnpj/dados-publicos-cnpj';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const { date, estado } = await req.json();

    console.log(`[RFB] Consultando base pública para data: ${date}, estado: ${estado}`);

    // Verificar último sync
    const { data: lastSync } = await supabaseClient
      .from('rfb_sync_metadata')
      .select('last_sync, dataset_version')
      .single();

    // Log de compliance
    await supabaseClient
      .from('compliance_logs')
      .insert({
        user_id: user.id,
        action: 'rfb_data_query',
        details: { date, estado },
        legal_basis: 'LGPD Art. 7º - Dados públicos oficiais'
      });

    // NOTA IMPORTANTE: A base da RFB é atualizada mensalmente e tem delay de até 90 dias
    // Para implementação completa, seria necessário:
    // 1. Download periódico dos arquivos ZIP da RFB (cron job)
    // 2. Parse dos arquivos CSV de estabelecimentos
    // 3. Indexação em banco de dados otimizado para consultas
    // 4. Cache de consultas frequentes

    const disclaimer = `
      ⚠️ IMPORTANTE - Base Oficial Receita Federal:
      - Atualização: Mensal
      - Delay esperado: 60-90 dias a partir da data de abertura
      - Fonte: Dados Públicos CNPJ - RFB
      - Esta é a fonte oficial e 100% legal
    `;

    // Buscar dados no cache/base local se disponível
    const { data: companies, error } = await supabaseClient
      .from('rfb_companies_cache')
      .select('*')
      .eq('data_abertura', date)
      .eq('estado', estado)
      .limit(100);

    if (error) {
      console.error('[RFB] Erro ao consultar cache:', error);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        source: 'rfb',
        companies: companies || [],
        last_sync: lastSync?.last_sync,
        dataset_version: lastSync?.dataset_version,
        disclaimer,
        note: 'Dados oficiais - delay de até 90 dias é esperado'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[RFB] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
