import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cnpj, leadId, contactId, userId } = await req.json();
    
    console.log("🏢 Enriquecendo dados de sócios para CNPJ:", cnpj);

    if (!cnpj) {
      throw new Error('CNPJ não fornecido');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Limpar CNPJ
    const cleanCNPJ = cnpj.replace(/\D/g, '');

    let partnersData = {
      partners: [] as any[],
      company: null as any,
      decisionMakers: [] as any[]
    };

    // 1. Tentar obter dados da Receita Federal
    try {
      console.log("🔍 Consultando Receita Federal...");
      
      const receitaUrl = `https://www.receitaws.com.br/v1/cnpj/${cleanCNPJ}`;
      const receitaResponse = await fetch(receitaUrl);

      if (receitaResponse.ok) {
        const receitaData = await receitaResponse.json();
        console.log("✅ Dados da Receita obtidos");

        partnersData.company = {
          nome: receitaData.nome,
          fantasia: receitaData.fantasia,
          porte: receitaData.porte,
          natureza_juridica: receitaData.natureza_juridica,
          capital_social: receitaData.capital_social,
          abertura: receitaData.abertura,
          situacao: receitaData.situacao,
          atividade_principal: receitaData.atividade_principal
        };

        // Processar QSA (Quadro de Sócios e Administradores)
        if (receitaData.qsa && Array.isArray(receitaData.qsa)) {
          partnersData.partners = receitaData.qsa.map((socio: any) => ({
            nome: socio.nome,
            qualificacao: socio.qual,
            data_entrada: socio.data_entrada,
            pais_origem: socio.pais_origem,
            representante_legal: socio.nome_rep_legal,
            qualificacao_representante: socio.qual_rep_legal
          }));

          // Identificar decisores (administradores, sócios majoritários)
          partnersData.decisionMakers = receitaData.qsa
            .filter((socio: any) => {
              const qual = (socio.qual || '').toLowerCase();
              return qual.includes('administrador') || 
                     qual.includes('diretor') || 
                     qual.includes('presidente') ||
                     qual.includes('sócio') && qual.includes('administrador');
            })
            .map((decisor: any) => ({
              nome: decisor.nome,
              cargo: decisor.qual,
              tipo: 'decisor',
              fonte: 'receita_federal'
            }));
        }
      }
    } catch (error) {
      console.log("⚠️ Erro ao consultar Receita Federal:", error);
    }

    // 2. Tentar enriquecer com CNPJA API (se disponível)
    try {
      const cnpjaToken = Deno.env.get('CNPJA_API_KEY');
      
      if (cnpjaToken) {
        console.log("🔍 Consultando CNPJA...");
        
        const cnpjaResponse = await fetch(`https://api.cnpja.com/office/${cleanCNPJ}`, {
          headers: {
            'Authorization': cnpjaToken
          }
        });

        if (cnpjaResponse.ok) {
          const cnpjaData = await cnpjaResponse.json();
          console.log("✅ Dados CNPJA obtidos");

          // Complementar dados da empresa
          if (cnpjaData.company) {
            partnersData.company = {
              ...partnersData.company,
              ...cnpjaData.company,
              email: cnpjaData.email,
              phone: cnpjaData.phone
            };
          }

          // Complementar sócios
          if (cnpjaData.members && Array.isArray(cnpjaData.members)) {
            const existingPartnerNames = new Set(partnersData.partners.map(p => p.nome));
            
            cnpjaData.members.forEach((member: any) => {
              if (!existingPartnerNames.has(member.name)) {
                partnersData.partners.push({
                  nome: member.name,
                  qualificacao: member.role,
                  documento: member.document,
                  participacao: member.equity
                });
              }
            });
          }
        }
      }
    } catch (error) {
      console.log("⚠️ Erro ao consultar CNPJA:", error);
    }

    // 3. Salvar dados enriquecidos no banco
    if (partnersData.partners.length > 0) {
      // Atualizar lead com dados da empresa
      if (leadId && partnersData.company) {
        const { error: leadError } = await supabaseClient
          .from('leads')
          .update({
            observacoes: JSON.stringify({
              company_enriched: partnersData.company,
              partners_count: partnersData.partners.length,
              decision_makers_count: partnersData.decisionMakers.length,
              enriched_at: new Date().toISOString()
            }),
            updated_at: new Date().toISOString()
          })
          .eq('id', leadId);

        if (leadError) {
          console.error("❌ Erro ao atualizar lead:", leadError);
        }
      }

      // Criar/atualizar contatos para decisores
      if (partnersData.decisionMakers.length > 0) {
        const contactsToUpsert = partnersData.decisionMakers.map(decisor => ({
          user_id: userId,
          lead_id: leadId,
          nome: decisor.nome,
          cargo: decisor.cargo,
          empresa: partnersData.company?.nome || partnersData.company?.fantasia,
          fonte: 'enriquecimento_socios',
          tags: ['decisor', 'socio', 'enriquecido'],
          observacoes: JSON.stringify({
            partner_info: partnersData.partners.find(p => p.nome === decisor.nome),
            enriched_at: new Date().toISOString()
          }),
          created_at: new Date().toISOString()
        }));

        const { data: insertedContacts, error: contactsError } = await supabaseClient
          .from('contacts')
          .upsert(contactsToUpsert, { 
            onConflict: 'nome,empresa',
            ignoreDuplicates: false 
          })
          .select();

        if (contactsError) {
          console.error("❌ Erro ao criar contatos de decisores:", contactsError);
        } else {
          console.log(`✅ ${insertedContacts?.length || 0} decisores criados/atualizados`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        cnpj: cleanCNPJ,
        company: partnersData.company,
        partnersCount: partnersData.partners.length,
        decisionMakersCount: partnersData.decisionMakers.length,
        partners: partnersData.partners,
        decisionMakers: partnersData.decisionMakers,
        enrichedAt: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("❌ Erro no enriquecimento de sócios:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
