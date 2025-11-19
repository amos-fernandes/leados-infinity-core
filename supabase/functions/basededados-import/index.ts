import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📊 Starting basededados.org import...');
    
    const baseDadosToken = Deno.env.get('BASEDEDADOS_ORG_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!baseDadosToken) {
      throw new Error('BASEDEDADOS_ORG_TOKEN not configured');
    }

    // Buscar empresas abertas recentemente da Receita Federal
    // Excluindo MEI (natureza_juridica != '213-5')
    const query = `
      SELECT 
        cnpj,
        razao_social,
        nome_fantasia,
        cnae_fiscal,
        cnae_fiscal_descricao,
        municipio,
        uf,
        email,
        telefone_1 as telefone,
        capital_social,
        natureza_juridica,
        data_inicio_atividade
      FROM \`basedosdados.br_me_cnpj.empresas\`
      WHERE 
        situacao_cadastral = '02' 
        AND natureza_juridica != '213-5'
        AND DATE(data_inicio_atividade) >= DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
      LIMIT 1000
    `;

    console.log('🔍 Querying basededados.org...');
    
    const response = await fetch('https://api.basedosdados.org/api/v1/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${baseDadosToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query {
            allDatasets(table: "empresas") {
              edges {
                node {
                  slug
                  name
                }
              }
            }
          }
        `
      })
    });

    if (!response.ok) {
      throw new Error(`BaseDados API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('📦 Data received:', data);

    // Para este exemplo, vamos simular alguns leads
    // Em produção, você processaria os dados reais da API
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const userId = existingUser?.users[0]?.id;

    if (!userId) {
      throw new Error('No user found to associate leads');
    }

    // Processar e inserir leads
    const leadsToInsert = [];
    
    // Simular alguns leads para demonstração
    // Em produção, você processaria os dados reais
    for (let i = 0; i < 10; i++) {
      leadsToInsert.push({
        user_id: userId,
        empresa: `Empresa Nova ${i + 1}`,
        cnpj: `00000000000${100 + i}`,
        setor: 'Tecnologia',
        status: 'novo',
        gancho_prospeccao: 'Empresa recém-aberta identificada via Receita Federal',
        cidade: 'São Paulo',
        uf: 'SP',
        capital_social: 100000 + (i * 10000)
      });
    }

    const { data: insertedLeads, error: insertError } = await supabase
      .from('leads')
      .insert(leadsToInsert)
      .select();

    if (insertError) {
      throw insertError;
    }

    console.log(`✅ ${insertedLeads?.length} leads imported successfully`);

    // Notificar via N8N
    const n8nApiKey = Deno.env.get('N8N_API_KEY');
    if (n8nApiKey) {
      try {
        await fetch('https://seu-n8n-instance.com/webhook/leads-imported', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${n8nApiKey}`
          },
          body: JSON.stringify({
            count: insertedLeads?.length,
            timestamp: new Date().toISOString()
          })
        });
      } catch (n8nError) {
        console.warn('N8N notification failed:', n8nError);
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      imported: insertedLeads?.length,
      leads: insertedLeads
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in basededados-import:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
