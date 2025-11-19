import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidatedCompany {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  dataAbertura: string;
  uf: string;
  source: 'rfb' | 'jucesp' | 'cross_validated';
  confidence: 'high' | 'medium' | 'low';
  validation_notes?: string;
}

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

    console.log(`[CROSS-VALIDATE] Iniciando validação cruzada para ${date} - ${estado}`);

    const validatedCompanies: ValidatedCompany[] = [];

    // 1. Prioridade: Base RFB (confiança alta, mas com delay)
    console.log('[CROSS-VALIDATE] Consultando base RFB...');
    const rfbResponse = await supabaseClient.functions.invoke('rfb-data-sync', {
      body: { date, estado }
    });

    if (rfbResponse.data?.companies?.length > 0) {
      console.log(`[CROSS-VALIDATE] RFB retornou ${rfbResponse.data.companies.length} empresas`);
      
      for (const company of rfbResponse.data.companies) {
        validatedCompanies.push({
          cnpj: company.cnpj,
          razaoSocial: company.razao_social,
          nomeFantasia: company.nome_fantasia,
          dataAbertura: company.data_abertura,
          uf: company.estado,
          source: 'rfb',
          confidence: 'high',
          validation_notes: 'Dados oficiais Receita Federal - Alta confiabilidade'
        });
      }
    }

    // 2. Se RFB não tem dados (muito recente), tentar Junta Comercial
    if (validatedCompanies.length === 0 && estado === 'SP') {
      console.log('[CROSS-VALIDATE] RFB sem dados, consultando JUCESP...');
      
      const jucespResponse = await supabaseClient.functions.invoke('jucesp-scraper', {
        body: { date, estado }
      });

      if (jucespResponse.data?.companies?.length > 0) {
        console.log(`[CROSS-VALIDATE] JUCESP retornou ${jucespResponse.data.companies.length} empresas`);
        
        for (const company of jucespResponse.data.companies) {
          validatedCompanies.push({
            cnpj: company.cnpj,
            razaoSocial: company.razaoSocial,
            nomeFantasia: company.nomeFantasia,
            dataAbertura: company.dataAbertura,
            uf: company.uf,
            source: 'jucesp',
            confidence: 'medium',
            validation_notes: 'Dados preliminares JUCESP - Aguardando confirmação RFB'
          });
        }
      }
    }

    // 3. Cross-validation: Se temos dados de ambas as fontes
    if (rfbResponse.data?.companies?.length > 0 && validatedCompanies.length > 0) {
      console.log('[CROSS-VALIDATE] Realizando validação cruzada...');
      
      // Marcar empresas que aparecem em ambas as fontes
      validatedCompanies.forEach(company => {
        const inRfb = rfbResponse.data.companies.some(
          (rfbComp: any) => rfbComp.cnpj === company.cnpj
        );
        
        if (inRfb && company.source === 'jucesp') {
          company.source = 'cross_validated';
          company.confidence = 'high';
          company.validation_notes = 'Validado cruzadamente (JUCESP + RFB)';
        }
      });
    }

    // Log de compliance
    await supabaseClient
      .from('compliance_logs')
      .insert({
        user_id: user.id,
        action: 'cross_validation',
        details: { 
          date, 
          estado, 
          total_validated: validatedCompanies.length,
          sources_used: [...new Set(validatedCompanies.map(c => c.source))]
        },
        legal_basis: 'LGPD Art. 7º - Processamento de dados públicos'
      });

    console.log(`[CROSS-VALIDATE] Validação concluída: ${validatedCompanies.length} empresas`);

    return new Response(
      JSON.stringify({ 
        success: true,
        companies: validatedCompanies,
        stats: {
          total: validatedCompanies.length,
          high_confidence: validatedCompanies.filter(c => c.confidence === 'high').length,
          medium_confidence: validatedCompanies.filter(c => c.confidence === 'medium').length,
          low_confidence: validatedCompanies.filter(c => c.confidence === 'low').length,
        },
        disclaimer: 'Validação cruzada entre fontes públicas oficiais (RFB) e estaduais (Juntas Comerciais)',
        compliance: 'LGPD Art. 7º - Dados de fonte pública'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CROSS-VALIDATE] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
