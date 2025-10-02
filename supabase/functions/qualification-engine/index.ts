import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QualificationCriteria {
  requiredCnaes?: string[];
  requiredUfs?: string[];
  minCapitalSocial?: number;
  maxCapitalSocial?: number;
  requiredRegimeTributario?: string[];
  excludedSituacoes?: string[];
}

interface QualificationEngineRequest {
  criteria?: QualificationCriteria;
  batchSize?: number;
  userId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      criteria = {}, 
      batchSize = 5,
      userId 
    }: QualificationEngineRequest = await req.json();

    console.log('🚀 Iniciando Motor de Qualificação de Leads');

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get leads to process - incluir leads qualificados que precisam de enriquecimento
    let query = supabase
      .from('leads')
      .select('*')
      .or('status.eq.novo,and(status.eq.qualificado,whatsapp_business.is.null)')
      .limit(batchSize);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: leadsToProcess, error: leadsError } = await query;

    if (leadsError) {
      throw new Error(`Erro ao buscar leads: ${leadsError.message}`);
    }

    if (!leadsToProcess || leadsToProcess.length === 0) {
      console.log('📭 Nenhum lead encontrado para processar');
      return new Response(JSON.stringify({ 
        message: 'Nenhum lead encontrado para enriquecimento',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`📊 Encontrados ${leadsToProcess.length} leads para processar`);

    const results = {
      processed: 0,
      qualified: 0,
      unqualified: 0,
      errors: 0,
      details: [] as any[]
    };

    // Process each lead through the pipeline
    for (const lead of leadsToProcess) {
      console.log(`\n🔄 Processando lead: ${lead.empresa} (ID: ${lead.id})`);
      console.log(`   Status atual: ${lead.status}, WhatsApp: ${lead.whatsapp || 'N/A'}, Website: ${lead.website_validated ? 'Validado' : 'Não validado'}`);
      
      try {
        // Update status to PROCESSING (apenas se for novo)
        if (lead.status === 'novo') {
          await supabase
            .from('leads')
            .update({ status: 'PROCESSING' })
            .eq('id', lead.id);
        }

        let currentLead = { ...lead };
        
        // === ESTAÇÃO 1: BUSCA DE E-MAIL ===
        if (!currentLead.email && currentLead.website) {
          console.log('📧 Iniciando busca de e-mail...');
          
          try {
            const emailResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/email-finder`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                domain: new URL(currentLead.website).hostname,
                leadId: lead.id
              }),
            });

            if (emailResponse.ok) {
              const emailResult = await emailResponse.json();
              if (emailResult.email) {
                currentLead.email = emailResult.email;
                console.log(`✅ E-mail encontrado: ${emailResult.email}`);
              }
            }
          } catch (error) {
            console.error('⚠️ Erro na busca de e-mail:', (error as Error).message);
          }
        }

        // === ESTAÇÃO 2: VALIDAÇÃO DE WHATSAPP ===
        if (currentLead.telefone || currentLead.whatsapp) {
          console.log('📱 Iniciando validação de WhatsApp...');
          
          const phoneToValidate = currentLead.whatsapp || currentLead.telefone;
          try {
            const whatsappResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/validate-whatsapp-number`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                phone: phoneToValidate,
                phoneNumberId: Deno.env.get('PHONE_NUMBER_ID') || '5562991792303'
              }),
            });

            if (whatsappResponse.ok) {
              const whatsappResult = await whatsappResponse.json();
              if (whatsappResult.valid) {
                await supabase
                  .from('leads')
                  .update({ 
                    whatsapp_business: whatsappResult.phone,
                    whatsapp: whatsappResult.phone 
                  })
                  .eq('id', lead.id);
                console.log(`✅ WhatsApp validado: ${whatsappResult.phone}`);
              } else {
                console.log('⚠️ Número não possui WhatsApp ativo');
              }
            }
          } catch (error) {
            console.error('⚠️ Erro na validação de WhatsApp:', (error as Error).message);
          }
        }

        // === ESTAÇÃO 3: ANÁLISE DE WEBSITE ===
        if (currentLead.website && !currentLead.website_validated) {
          console.log('🌐 Iniciando análise de website...');
          
          try {
            const websiteResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/scrape-contact-info`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                website: currentLead.website,
                leadId: lead.id,
                userId: currentLead.user_id
              }),
            });

            if (websiteResponse.ok) {
              const websiteResult = await websiteResponse.json();
              console.log('✅ Website analisado e dados atualizados');
              
              // Reload lead data
              const { data: updatedLead } = await supabase
                .from('leads')
                .select('*')
                .eq('id', lead.id)
                .single();
              
              if (updatedLead) {
                currentLead = updatedLead;
              }
            }
          } catch (error) {
            console.error('⚠️ Erro na análise de website:', (error as Error).message);
          }
        }

        // === ESTAÇÃO 4: ENRIQUECIMENTO CNPJ ===
        // Check if we have CNPJ data or try to extract from company name
        if (!currentLead.cnpj && !currentLead.tech_stack?.codigo_cnae) {
          console.log('🏢 Dados de CNPJ não encontrados, tentando extrair...');
          
          // For now, skip CNPJ enrichment if not available
          // In production, you could implement company name to CNPJ search
          console.log('⚠️ CNPJ não disponível para enriquecimento automático');
        } else if (currentLead.cnpj && !currentLead.tech_stack?.codigo_cnae) {
          console.log('🔍 Iniciando enriquecimento CNPJ...');
          
          try {
            const cnpjResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/cnpj-enrichment`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                cnpj: currentLead.cnpj,
                leadId: lead.id
              }),
            });

            if (cnpjResponse.ok) {
              const cnpjResult = await cnpjResponse.json();
              console.log('✅ Lead enriquecido com dados CNPJ');
              
              // Reload lead data
              const { data: updatedLead } = await supabase
                .from('leads')
                .select('*')
                .eq('id', lead.id)
                .single();
              
              if (updatedLead) {
                currentLead = updatedLead;
              }
            }
          } catch (error) {
            console.error('⚠️ Erro no enriquecimento CNPJ:', (error as Error).message);
          }
        }

        // === ESTAÇÃO 5: VALIDAÇÃO E QUALIFICAÇÃO ===
        console.log('🎯 Iniciando validação de critérios...');
        
        // Set default criteria if none provided
        const defaultCriteria: QualificationCriteria = {
          requiredUfs: ['SP', 'RJ', 'SC', 'PR', 'MG'],
          excludedSituacoes: ['BAIXADA', 'SUSPENSA', 'INAPTA'],
          minCapitalSocial: 10000, // R$ 10.000
          ...criteria
        };

        try {
          const validationResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/lead-validator`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              leadId: lead.id,
              criteria: defaultCriteria
            }),
          });

          if (validationResponse.ok) {
            const validationResult = await validationResponse.json();
            
            if (validationResult.qualified) {
              results.qualified++;
              console.log(`✅ Lead QUALIFICADO: ${lead.empresa} (Score: ${validationResult.score}%)`);
            } else {
              results.unqualified++;
              console.log(`❌ Lead DESQUALIFICADO: ${lead.empresa} (Score: ${validationResult.score}%)`);
            }

            results.details.push({
              leadId: lead.id,
              empresa: lead.empresa,
              status: validationResult.status,
              score: validationResult.score,
              qualified: validationResult.qualified
            });
          }
        } catch (error) {
          console.error('⚠️ Erro na validação:', (error as Error).message);
          
          // Mark as error
          await supabase
            .from('leads')
            .update({ status: 'ERROR' })
            .eq('id', lead.id);
          
          results.errors++;
        }

        results.processed++;

      } catch (error) {
        console.error(`❌ Erro ao processar lead ${lead.empresa}:`, (error as Error).message);
        
        // Revert status back to NEW for retry
        await supabase
          .from('leads')
          .update({ status: 'novo' })
          .eq('id', lead.id);
        
        results.errors++;
      }
    }

    console.log('\n🏁 Motor de Qualificação Concluído');
    console.log(`📊 Resultados: ${results.processed} processados, ${results.qualified} qualificados, ${results.unqualified} desqualificados, ${results.errors} erros`);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro crítico no motor de qualificação:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});