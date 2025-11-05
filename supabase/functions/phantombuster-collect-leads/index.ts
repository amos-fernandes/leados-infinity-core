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
    const { source, query, userId } = await req.json();
    
    console.log("🤖 PhantomBuster: Iniciando coleta de leads", { source, query });

    const phantomApiKey = Deno.env.get('PHANTOMBUSTER_API_KEY');
    if (!phantomApiKey) {
      throw new Error('PhantomBuster API key not configured');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Mapear fonte para Phantom ID apropriado
    const phantomMap: Record<string, string> = {
      'google-maps': 'Google Maps Scraper',
      'linkedin': 'LinkedIn Sales Navigator Search Export',
      'linkedin-company': 'LinkedIn Company Info Scraper',
      'apollo': 'Apollo.io Email Finder'
    };

    const phantomName = phantomMap[source] || phantomMap['google-maps'];

    // 1. Buscar Phantoms disponíveis
    const agentsResponse = await fetch('https://api.phantombuster.com/api/v2/agents/fetch-all', {
      headers: {
        'X-Phantombuster-Key': phantomApiKey
      }
    });

    if (!agentsResponse.ok) {
      throw new Error(`Failed to fetch agents: ${agentsResponse.statusText}`);
    }

    const agents = await agentsResponse.json();
    console.log("🤖 Phantoms disponíveis:", agents.length);

    // 2. Encontrar ou criar o Phantom apropriado
    let agent = agents.find((a: any) => a.name.includes(phantomName));
    
    if (!agent) {
      console.log("🤖 Criando novo Phantom:", phantomName);
      
      // Criar novo agent
      const createResponse = await fetch('https://api.phantombuster.com/api/v2/agents/save', {
        method: 'POST',
        headers: {
          'X-Phantombuster-Key': phantomApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `Leados - ${phantomName}`,
          scriptId: getScriptIdForSource(source),
          argument: buildPhantomArgument(source, query)
        })
      });

      if (!createResponse.ok) {
        throw new Error(`Failed to create agent: ${createResponse.statusText}`);
      }

      agent = await createResponse.json();
    }

    // 3. Lançar o Phantom
    console.log("🚀 Lançando Phantom:", agent.id);
    
    const launchResponse = await fetch(`https://api.phantombuster.com/api/v2/agents/launch`, {
      method: 'POST',
      headers: {
        'X-Phantombuster-Key': phantomApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: agent.id,
        argument: buildPhantomArgument(source, query),
        bonusArgument: {
          maxResults: 100,
          extractEmails: true,
          extractPhones: true,
          enrichWithCNPJ: source === 'google-maps'
        }
      })
    });

    if (!launchResponse.ok) {
      throw new Error(`Failed to launch agent: ${launchResponse.statusText}`);
    }

    const launchResult = await launchResponse.json();
    console.log("✅ Phantom lançado:", launchResult.containerId);

    // 4. Aguardar conclusão (polling)
    let containerStatus = 'running';
    let attempts = 0;
    const maxAttempts = 60; // 5 minutos max

    while (containerStatus === 'running' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
      
      const statusResponse = await fetch(`https://api.phantombuster.com/api/v2/containers/fetch?id=${launchResult.containerId}`, {
        headers: {
          'X-Phantombuster-Key': phantomApiKey
        }
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        containerStatus = statusData.status;
        console.log(`🔄 Status: ${containerStatus} (${attempts}/${maxAttempts})`);
      }
      
      attempts++;
    }

    // 5. Buscar resultados
    const outputResponse = await fetch(`https://api.phantombuster.com/api/v2/agents/fetch-output?id=${agent.id}`, {
      headers: {
        'X-Phantombuster-Key': phantomApiKey
      }
    });

    if (!outputResponse.ok) {
      throw new Error(`Failed to fetch output: ${outputResponse.statusText}`);
    }

    const output = await outputResponse.json();
    const results = output.resultObject || [];
    
    console.log(`📊 Resultados coletados: ${results.length} leads`);

    // 6. Processar e salvar no Supabase
    const leadsToInsert = [];
    
    for (const result of results) {
      const leadData = {
        user_id: userId,
        nome_empresa: result.name || result.title || 'Empresa',
        email: result.email || null,
        telefone: cleanPhone(result.phone || result.phoneNumber),
        whatsapp_validado: false,
        cnpj: result.cnpj || null,
        cidade: result.city || result.address?.city || null,
        estado: result.state || result.address?.state || null,
        website: result.website || result.url || null,
        linkedin: result.linkedinUrl || null,
        categoria: result.category || result.industry || null,
        status: 'novo',
        pontuacao: null,
        fonte: `phantombuster-${source}`,
        observacoes: JSON.stringify(result),
        created_at: new Date().toISOString()
      };

      leadsToInsert.push(leadData);
    }

    // Inserir leads em batch
    if (leadsToInsert.length > 0) {
      const { data: insertedLeads, error: insertError } = await supabaseClient
        .from('leads')
        .insert(leadsToInsert)
        .select();

      if (insertError) {
        console.error("❌ Erro ao inserir leads:", insertError);
        throw insertError;
      }

      console.log(`✅ ${insertedLeads.length} leads inseridos no Supabase`);

      // Criar contatos também
      const contactsToInsert = insertedLeads
        .filter(lead => lead.email || lead.telefone)
        .map(lead => ({
          user_id: userId,
          lead_id: lead.id,
          nome: lead.nome_empresa,
          email: lead.email,
          telefone: lead.telefone,
          empresa: lead.nome_empresa,
          cargo: null,
          fonte: `phantombuster-${source}`,
          tags: [source, 'phantombuster'],
          created_at: new Date().toISOString()
        }));

      if (contactsToInsert.length > 0) {
        const { error: contactError } = await supabaseClient
          .from('contacts')
          .insert(contactsToInsert);

        if (contactError) {
          console.error("⚠️ Erro ao inserir contatos:", contactError);
        } else {
          console.log(`✅ ${contactsToInsert.length} contatos criados`);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `${insertedLeads.length} leads coletados com PhantomBuster`,
          leads: insertedLeads.length,
          contacts: contactsToInsert.length,
          source,
          containerId: launchResult.containerId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        message: 'Nenhum lead encontrado',
        leads: 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("❌ Erro no PhantomBuster:", error);
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

function getScriptIdForSource(source: string): string {
  // IDs dos scripts do PhantomBuster (obtidos do marketplace)
  const scriptIds: Record<string, string> = {
    'google-maps': '5321', // Google Maps Scraper
    'linkedin': '4432',    // LinkedIn Sales Navigator
    'linkedin-company': '4201', // LinkedIn Company
    'apollo': '8923'       // Apollo.io
  };
  
  return scriptIds[source] || scriptIds['google-maps'];
}

function buildPhantomArgument(source: string, query: any): any {
  switch (source) {
    case 'google-maps':
      return {
        searches: query.search || query,
        numberOfPlacesPerSearch: 100,
        extractEmails: 'true',
        extractPhones: 'true'
      };
    
    case 'linkedin':
      return {
        salesNavigatorUrl: query.url || query,
        numberOfProfiles: 100,
        extractEmails: 'true'
      };
    
    case 'linkedin-company':
      return {
        companyUrls: Array.isArray(query) ? query : [query],
        extractEmployees: 'true'
      };
    
    case 'apollo':
      return {
        searches: query.search || query,
        numberOfResults: 100
      };
    
    default:
      return query;
  }
}

function cleanPhone(phone: string | null): string | null {
  if (!phone) return null;
  
  // Remove caracteres não numéricos
  const cleaned = phone.replace(/\D/g, '');
  
  // Adiciona código do país se não tiver
  if (cleaned.length === 11 && !cleaned.startsWith('55')) {
    return `55${cleaned}`;
  }
  
  return cleaned.length >= 10 ? cleaned : null;
}
