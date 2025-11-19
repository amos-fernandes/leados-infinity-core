import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProspectingRequest {
  userId: string;
  targetCount?: number;
  sources?: ('rfb' | 'google_maps' | 'basededados' | 'jucesp')[];
  qualificationCriteria?: {
    requiredUfs?: string[];
    minCapitalSocial?: number;
    excludedSituacoes?: string[];
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      userId,
      targetCount = 1000,
      sources = ['rfb', 'google_maps', 'basededados'],
      qualificationCriteria = {}
    }: ProspectingRequest = await req.json();

    console.log('🚀 INICIANDO ORQUESTRAÇÃO DE PROSPECÇÃO');
    console.log(`📊 Meta: ${targetCount} suspects/prospects`);
    console.log(`📡 Fontes: ${sources.join(', ')}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results = {
      totalCaptured: 0,
      totalQualified: 0,
      bySource: {} as Record<string, number>,
      errors: [] as string[],
      startTime: new Date().toISOString(),
      endTime: '',
      duration: 0
    };

    const startTime = Date.now();

    // ===== FASE 1: CAPTURA DE SUSPECTS/PROSPECTS =====
    console.log('\n📥 FASE 1: CAPTURA DE SUSPECTS/PROSPECTS');
    
    const targetPerSource = Math.ceil(targetCount / sources.length);

    // 1.1 - Receita Federal (RFB Cache)
    if (sources.includes('rfb')) {
      console.log('\n🏛️ Capturando da Receita Federal...');
      try {
        // Verificar se há dados no cache
        const { count: cacheCount } = await supabase
          .from('rfb_companies_cache')
          .select('*', { count: 'exact', head: true });

        console.log(`📊 Cache RFB tem ${cacheCount || 0} registros`);

        if (!cacheCount || cacheCount === 0) {
          console.log('⚠️ Cache RFB vazio, pulando captura da RFB');
          console.log('💡 Dica: Use a função rfb-data-sync para popular o cache');
          results.bySource['rfb'] = 0;
        } else {
          // Buscar empresas do cache RFB (dados reais)
          const today = new Date();
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 7); // Buscar últimos 7 dias
          
          const dateStr = yesterday.toISOString().split('T')[0];
          const estados = qualificationCriteria.requiredUfs || ['SP', 'RJ', 'MG', 'PR', 'RS'];
          
          let rfbTotal = 0;
          for (const estado of estados) {
            try {
              // Buscar diretamente do cache RFB
              const { data: rfbCompanies, error: rfbError } = await supabase
                .from('rfb_companies_cache')
                .select('*')
                .eq('estado', estado)
                .gte('data_abertura', dateStr)
                .eq('mei', false)
                .limit(Math.ceil(targetPerSource / estados.length));

              if (rfbError) {
                console.error(`❌ Erro ao buscar RFB (${estado}):`, rfbError);
                continue;
              }

              if (rfbCompanies && rfbCompanies.length > 0) {
                const leadsToInsert = rfbCompanies.map(company => ({
                  user_id: userId,
                  empresa: company.nome_fantasia || company.razao_social,
                  cnpj: company.cnpj,
                  setor: company.atividade_principal || 'Não especificado',
                  status: 'novo',
                  gancho_prospeccao: `Empresa identificada via RFB - ${company.porte || 'Porte não informado'}`,
                  cidade: company.cidade,
                  uf: company.estado,
                  capital_social: company.capital_social,
                  cnae_principal: company.atividade_principal,
                  regime_tributario: company.natureza_juridica
                }));

                const { data: insertedLeads, error: insertError } = await supabase
                  .from('leads')
                  .upsert(leadsToInsert, { 
                    onConflict: 'cnpj',
                    ignoreDuplicates: true 
                  })
                  .select();

                if (!insertError && insertedLeads) {
                  rfbTotal += insertedLeads.length;
                  console.log(`✅ RFB (${estado}): ${insertedLeads.length} leads capturados`);
                }
              }
            } catch (err) {
              console.error(`❌ Erro no estado ${estado}:`, err);
            }
          }

          results.bySource['rfb'] = rfbTotal;
          results.totalCaptured += rfbTotal;
          console.log(`✅ RFB Total: ${rfbTotal} leads capturados`);
        }
      } catch (error) {
        console.error('❌ Erro na captura RFB:', error);
        results.errors.push(`RFB: ${error.message}`);
      }
    }

    // 1.2 - Google Maps
    if (sources.includes('google_maps')) {
      console.log('\n🗺️ Capturando do Google Maps...');
      try {
        const searchTerms = [
          'empresas de tecnologia',
          'software house',
          'desenvolvimento de sistemas',
          'consultoria empresarial',
          'agência de marketing digital'
        ];

        const cities = ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Porto Alegre'];
        let googleMapsTotal = 0;

        for (const city of cities.slice(0, 3)) {
          for (const term of searchTerms.slice(0, 2)) {
            try {
              const { data: gmapsData, error: gmapsError } = await supabase.functions.invoke('google-maps-scraper', {
                body: {
                  searchQuery: term,
                  location: city,
                  maxResults: 50,
                  userId
                }
              });

              if (!gmapsError && gmapsData?.leads) {
                googleMapsTotal += gmapsData.leads.length;
              }
            } catch (err) {
              console.warn(`⚠️ Erro no Google Maps (${city} - ${term}):`, err);
            }
          }
        }

        results.bySource['google_maps'] = googleMapsTotal;
        results.totalCaptured += googleMapsTotal;
        console.log(`✅ Google Maps: ${googleMapsTotal} leads capturados`);
      } catch (error) {
        console.error('❌ Erro na captura Google Maps:', error);
        results.errors.push(`Google Maps: ${error.message}`);
      }
    }

    // 1.3 - Base Dos Dados (dados reais)
    if (sources.includes('basededados')) {
      console.log('\n📊 Capturando do Base Dos Dados...');
      try {
        const { data: bddData, error: bddError } = await supabase.functions.invoke('basededados-import', {
          body: { userId }
        });

        if (!bddError && bddData?.leads) {
          results.bySource['basededados'] = bddData.leads.length;
          results.totalCaptured += bddData.leads.length;
          console.log(`✅ Base Dos Dados: ${bddData.leads.length} leads capturados`);
        } else {
          console.error('❌ Erro Base Dos Dados:', bddError);
          results.errors.push(`BaseDados: ${bddError?.message || 'Erro desconhecido'}`);
        }
      } catch (error) {
        console.error('❌ Erro na captura Base Dos Dados:', error);
        results.errors.push(`BaseDados: ${error.message}`);
      }
    }

    // 1.4 - JUCESP (dados reais)
    if (sources.includes('jucesp')) {
      console.log('\n🏢 Capturando da JUCESP...');
      try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0];

        const { data: jucespData, error: jucespError } = await supabase.functions.invoke('jucesp-scraper', {
          body: { 
            date: dateStr,
            estado: 'SP'
          }
        });

        if (!jucespError && jucespData?.companies && jucespData.companies.length > 0) {
          const leadsToInsert = jucespData.companies.map((company: any) => ({
            user_id: userId,
            empresa: company.nomeFantasia || company.razaoSocial,
            cnpj: company.cnpj,
            setor: 'Comércio e Serviços',
            status: 'novo',
            gancho_prospeccao: 'Empresa registrada recentemente na JUCESP',
            cidade: company.municipio,
            uf: company.uf,
            capital_social: null
          }));

          const { data: insertedLeads, error: insertError } = await supabase
            .from('leads')
            .upsert(leadsToInsert, { 
              onConflict: 'cnpj',
              ignoreDuplicates: true 
            })
            .select();

          if (!insertError && insertedLeads) {
            results.bySource['jucesp'] = insertedLeads.length;
            results.totalCaptured += insertedLeads.length;
            console.log(`✅ JUCESP: ${insertedLeads.length} leads capturados`);
          }
        } else {
          console.log('⚠️ JUCESP: Nenhuma empresa encontrada');
          results.bySource['jucesp'] = 0;
        }
      } catch (error) {
        console.error('❌ Erro na captura JUCESP:', error);
        results.errors.push(`JUCESP: ${error.message}`);
      }
    }

    console.log(`\n📊 FASE 1 CONCLUÍDA: ${results.totalCaptured} suspects/prospects capturados`);

    // ===== FASE 2: QUALIFICAÇÃO DOS LEADS =====
    console.log('\n🎯 FASE 2: QUALIFICAÇÃO DE LEADS');
    console.log('Iniciando motor de qualificação...');

    try {
      // Buscar leads não qualificados
      const { data: leadsToQualify } = await supabase
        .from('leads')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'novo')
        .limit(Math.min(results.totalCaptured, targetCount));

      if (leadsToQualify && leadsToQualify.length > 0) {
        console.log(`📋 ${leadsToQualify.length} leads aguardando qualificação`);

        // Processar em lotes de 50
        const batchSize = 50;
        let qualifiedCount = 0;

        for (let i = 0; i < leadsToQualify.length; i += batchSize) {
          const batch = leadsToQualify.slice(i, i + batchSize);
          
          console.log(`\n🔄 Processando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(leadsToQualify.length / batchSize)}`);

          const { data: qualificationResult, error: qualError } = await supabase.functions.invoke('qualification-engine', {
            body: {
              userId,
              batchSize: batch.length,
              criteria: qualificationCriteria
            }
          });

          if (!qualError && qualificationResult?.qualified) {
            qualifiedCount += qualificationResult.qualified;
            console.log(`✅ Lote qualificado: ${qualificationResult.qualified} leads`);
          }

          // Aguardar 2 segundos entre lotes para não sobrecarregar
          if (i + batchSize < leadsToQualify.length) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }

        results.totalQualified = qualifiedCount;
        console.log(`\n✅ FASE 2 CONCLUÍDA: ${qualifiedCount} leads qualificados`);
      } else {
        console.log('⚠️ Nenhum lead novo encontrado para qualificação');
      }
    } catch (error) {
      console.error('❌ Erro na qualificação:', error);
      results.errors.push(`Qualificação: ${error.message}`);
    }

    // ===== RESULTADOS FINAIS =====
    const endTime = Date.now();
    results.endTime = new Date().toISOString();
    results.duration = Math.round((endTime - startTime) / 1000); // segundos

    console.log('\n🏁 ORQUESTRAÇÃO CONCLUÍDA');
    console.log(`⏱️ Duração: ${results.duration}s`);
    console.log(`📊 Total capturado: ${results.totalCaptured}`);
    console.log(`🎯 Total qualificado: ${results.totalQualified}`);
    console.log(`📈 Taxa de qualificação: ${results.totalCaptured > 0 ? Math.round((results.totalQualified / results.totalCaptured) * 100) : 0}%`);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ ERRO CRÍTICO NA ORQUESTRAÇÃO:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
