import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CNPJData {
  cnpj: string;
  nome: string;
  nome_fantasia?: string;
  situacao_cadastral: string;
  data_abertura: string;
  cnae_principal: string;
  cnae_descricao: string;
  natureza_juridica: string;
  porte: string;
  municipio: string;
  uf: string;
  telefone?: string;
  email?: string;
  capital_social: number;
  socios: Array<{
    nome: string;
    cargo: string;
    cpf?: string;
  }>;
}

interface AgnoAgent {
  id: string;
  name: string;
  description: string;
  tools: string[];
}

class CNPJCollectorAgent {
  private name: string;
  private description: string;
  private supabase: any;

  constructor() {
    this.name = "CNPJ Data Collector";
    this.description = "Agente especializado em coletar dados oficiais de empresas brasileiras da Receita Federal";
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async searchCompaniesByFilters(filters: {
    uf?: string;
    municipio?: string;
    cnae?: string;
    situacao?: string;
    porte?: string;
    excludeMEI?: boolean;
  }): Promise<CNPJData[]> {
    console.log('🤖 Agno Agent: Iniciando busca por empresas com filtros:', filters);
    
    // API da Receita Federal - endpoint público
    const baseUrl = 'https://publica.cnpj.ws/cnpj';
    const companies: CNPJData[] = [];
    
    try {
      // Simulação de busca por empresas em Goiânia - GO
      // Em produção, integraria com APIs oficiais como:
      // - Receita Federal (dados públicos)
      // - Juceg (Junta Comercial de Goiás)
      // - APIs de dados empresariais
      
      const mockData: CNPJData[] = [
        {
          cnpj: "11.222.333/0001-44",
          nome: "TECH SOLUTIONS LTDA",
          nome_fantasia: "TechSol",
          situacao_cadastral: "ATIVA",
          data_abertura: "2020-03-15",
          cnae_principal: "6201-5/00",
          cnae_descricao: "Desenvolvimento de programas de computador sob encomenda",
          natureza_juridica: "206-2",
          porte: "DEMAIS",
          municipio: "GOIANIA",
          uf: "GO",
          telefone: "(62) 3234-5678",
          email: "contato@techsol.com.br",
          capital_social: 50000,
          socios: [
            { nome: "JOÃO SILVA", cargo: "SÓCIO-ADMINISTRADOR" },
            { nome: "MARIA SANTOS", cargo: "SÓCIA" }
          ]
        },
        {
          cnpj: "22.333.444/0001-55",
          nome: "DISTRIBUIDORA ALPHA LTDA",
          nome_fantasia: "Alpha Distribuidora",
          situacao_cadastral: "ATIVA",
          data_abertura: "2018-07-22",
          cnae_principal: "4681-8/01",
          cnae_descricao: "Comércio atacadista de máquinas e equipamentos",
          natureza_juridica: "206-2",
          porte: "EPP",
          municipio: "GOIANIA",
          uf: "GO",
          telefone: "(62) 3345-6789",
          email: "comercial@alphadist.com.br",
          capital_social: 150000,
          socios: [
            { nome: "CARLOS OLIVEIRA", cargo: "SÓCIO-ADMINISTRADOR" },
            { nome: "ANA RODRIGUES", cargo: "SÓCIA" }
          ]
        },
        {
          cnpj: "33.444.555/0001-66",
          nome: "CONSULTORIA BETA EMPRESARIAL LTDA",
          nome_fantasia: "Beta Consultoria",
          situacao_cadastral: "ATIVA",
          data_abertura: "2019-11-08",
          cnae_principal: "7020-4/00",
          cnae_descricao: "Atividades de consultoria em gestão empresarial",
          natureza_juridica: "206-2",
          porte: "ME",
          municipio: "GOIANIA",
          uf: "GO",
          telefone: "(62) 3456-7890",
          email: "info@betaconsult.com.br",
          capital_social: 25000,
          socios: [
            { nome: "PEDRO ALMEIDA", cargo: "SÓCIO-ADMINISTRADOR" }
          ]
        }
      ];

      // Aplicar filtros
      let filteredData = mockData;
      
      if (filters.uf) {
        filteredData = filteredData.filter(company => company.uf === filters.uf);
      }
      
      if (filters.municipio) {
        filteredData = filteredData.filter(company => 
          company.municipio.toLowerCase().includes(filters.municipio!.toLowerCase())
        );
      }
      
      if (filters.excludeMEI) {
        filteredData = filteredData.filter(company => company.porte !== 'MEI');
      }
      
      if (filters.porte) {
        filteredData = filteredData.filter(company => company.porte === filters.porte);
      }

      companies.push(...filteredData);
      
      console.log(`🤖 Agno Agent: Encontradas ${companies.length} empresas`);
      return companies;
      
    } catch (error) {
      console.error('🚫 Erro na coleta de dados:', error);
      throw new Error(`Erro ao buscar empresas: ${error.message}`);
    }
  }

  async qualifyLead(company: CNPJData): Promise<any> {
    console.log(`🤖 Agno Agent: Qualificando lead para ${company.nome}`);
    
    // Lógica de qualificação BANT específica para C6 Bank
    const qualification = {
      qualificationScore: this.calculateBANTScore(company),
      urgencyLevel: this.calculateUrgency(company),
      decisionMaker: this.identifyDecisionMaker(company),
      contactChannels: {
        phone: company.telefone || '',
        email: company.email || '',
        status: 'pendente_validacao'
      },
      gancho_prospeccao: this.generateProspectHook(company),
      estimated_revenue: this.estimateRevenue(company),
      recommended_channel: company.telefone ? 'WhatsApp' : 'Email'
    };

    console.log(`🎯 Qualificação concluída: Score ${qualification.qualificationScore}`);
    return qualification;
  }

  private calculateBANTScore(company: CNPJData): string {
    let score = 0;
    
    // Budget: baseado no capital social e porte
    if (company.capital_social >= 100000) score += 25;
    else if (company.capital_social >= 50000) score += 20;
    else score += 10;
    
    // Authority: verifica se tem sócio-administrador
    if (company.socios.some(s => s.cargo.includes('ADMINISTRADOR'))) score += 25;
    else score += 15;
    
    // Need: baseado no CNAE (setores que mais precisam de conta PJ)
    const highNeedCNAEs = ['6201-5', '4681-8', '7020-4'];
    if (highNeedCNAEs.some(cnae => company.cnae_principal.includes(cnae))) score += 25;
    else score += 15;
    
    // Timing: empresas ativas e recentes têm mais necessidade
    const dataAbertura = new Date(company.data_abertura);
    const anosOperacao = (new Date().getFullYear() - dataAbertura.getFullYear());
    if (anosOperacao <= 3) score += 25;
    else if (anosOperacao <= 5) score += 20;
    else score += 10;
    
    if (score >= 85) return 'A';
    if (score >= 70) return 'B';
    return 'C';
  }

  private calculateUrgency(company: CNPJData): string {
    // Empresas maiores e em setores dinâmicos têm mais urgência
    if (company.porte === 'EPP' || company.capital_social >= 100000) return 'Alta';
    if (company.porte === 'DEMAIS' || company.capital_social >= 50000) return 'Média';
    return 'Baixa';
  }

  private identifyDecisionMaker(company: CNPJData) {
    const decisionMaker = company.socios.find(s => 
      s.cargo.includes('ADMINISTRADOR') || s.cargo.includes('DIRETOR')
    ) || company.socios[0];
    
    return {
      name: decisionMaker?.nome || 'Não identificado',
      role: decisionMaker?.cargo || 'Sócio'
    };
  }

  private generateProspectHook(company: CNPJData): string {
    const hooks = [
      `Empresa ${company.porte} em ${company.municipio} com potencial para conta PJ digital com benefícios exclusivos no C6 Bank.`,
      `${company.nome_fantasia || company.nome} pode economizar em tarifas bancárias com nossa conta PJ sem mensalidade.`,
      `Oportunidade para ${company.nome_fantasia || company.nome} acessar crédito facilitado e soluções digitais completas.`
    ];
    
    return hooks[Math.floor(Math.random() * hooks.length)];
  }

  private estimateRevenue(company: CNPJData): string {
    // Estimativa baseada no capital social e porte
    let estimate = 0;
    
    switch (company.porte) {
      case 'EPP':
        estimate = company.capital_social * 2; // R$ 300k - 800k
        break;
      case 'DEMAIS':
        estimate = company.capital_social * 1.5; // R$ 75k - 300k
        break;
      default:
        estimate = company.capital_social * 1.2; // Até R$ 75k
    }
    
    return `R$ ${estimate.toLocaleString('pt-BR')}`;
  }

  async saveLeadsToDatabase(leads: any[], userId: string, campaignId?: string) {
    console.log(`💾 Salvando ${leads.length} leads no banco de dados`);
    
    const leadPromises = leads.map(async (lead) => {
      // Inserir na tabela leads
      const { data: leadData, error: leadError } = await this.supabase
        .from('leads')
        .insert({
          user_id: userId,
          campaign_id: campaignId,
          empresa: lead.company.nome_fantasia || lead.company.nome,
          cnpj: lead.company.cnpj,
          telefone: lead.company.telefone,
          email: lead.company.email,
          endereco: `${lead.company.municipio}, ${lead.company.uf}`,
          setor: lead.company.cnae_descricao,
          status: 'novo',
          qualification_score: lead.qualification.qualificationScore,
          qualification_level: lead.qualification.urgencyLevel,
          approach_strategy: lead.qualification.gancho_prospeccao,
          estimated_revenue: lead.qualification.estimated_revenue,
          recommended_channel: lead.qualification.recommended_channel,
          source: 'agno_agent'
        })
        .select()
        .single();

      if (leadError) {
        console.error('Erro ao salvar lead:', leadError);
        return null;
      }

      // Inserir na tabela contacts
      if (lead.qualification.decisionMaker.name !== 'Não identificado') {
        await this.supabase
          .from('contacts')
          .insert({
            user_id: userId,
            lead_id: leadData.id,
            nome: lead.qualification.decisionMaker.name,
            cargo: lead.qualification.decisionMaker.role,
            telefone: lead.company.telefone,
            email: lead.company.email,
            empresa: lead.company.nome_fantasia || lead.company.nome
          });
      }

      return leadData;
    });

    const results = await Promise.all(leadPromises);
    const successfulLeads = results.filter(result => result !== null);
    
    console.log(`✅ ${successfulLeads.length} leads salvos com sucesso`);
    return successfulLeads;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, filters, campaignId } = await req.json();

    if (!userId) {
      throw new Error('userId é obrigatório');
    }

    console.log('🚀 Iniciando Agno Agent para coleta de prospects');
    
    // Inicializar o agente
    const agent = new CNPJCollectorAgent();
    
    // Definir filtros padrão para Goiânia
    const searchFilters = {
      uf: 'GO',
      municipio: 'GOIANIA',
      excludeMEI: true,
      situacao: 'ATIVA',
      ...filters
    };
    
    // Coletar empresas
    const companies = await agent.searchCompaniesByFilters(searchFilters);
    
    // Qualificar cada empresa
    const qualifiedLeads = [];
    for (const company of companies) {
      const qualification = await agent.qualifyLead(company);
      qualifiedLeads.push({
        company,
        qualification
      });
    }
    
    // Salvar no banco de dados
    const savedLeads = await agent.saveLeadsToDatabase(qualifiedLeads, userId, campaignId);
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Agno Agent coletou ${savedLeads.length} leads qualificados`,
        data: {
          leads_collected: savedLeads.length,
          agent_used: 'CNPJCollectorAgent',
          filters_applied: searchFilters,
          leads: savedLeads
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Erro no Agno Agent:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'Erro na coleta de prospects com Agno Agent'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});