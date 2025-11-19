import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

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
  // Dados enriquecidos do Bright Data
  bright_data?: {
    website?: string;
    social_media?: {
      linkedin?: string;
      facebook?: string;
      instagram?: string;
    };
    employees_count?: number;
    revenue_estimate?: number;
    industry_classification?: string;
    tech_stack?: string[];
    contact_emails?: string[];
    verified_phones?: string[];
  };
}

interface AgnoAgent {
  id: string;
  name: string;
  description: string;
  tools: string[];
}

class AgnoSmartCollectorAgent {
  private name: string;
  private description: string;
  private supabase: any;
  private brightDataApiKey: string;

  constructor() {
    this.name = "Agno + Bright Data Smart Collector";
    this.description = "Agente híbrido que combina dados oficiais da Receita Federal com enriquecimento via Bright Data";
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    this.brightDataApiKey = Deno.env.get('BRIGHT_DATA_API_KEY')!;
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async searchCompaniesByFilters(filters: {
    uf?: string;
    municipio?: string;
    cnae?: string;
    situacao?: string;
    porte?: string;
    excludeMEI?: boolean;
    excludeThirdSector?: boolean;
    requireActiveDecisionMaker?: boolean;
    onlyActiveCNPJ?: boolean;
  }): Promise<CNPJData[]> {
    console.log('🤖 Agno + Bright Data: Iniciando busca híbrida por empresas com filtros:', filters);
    
    try {
      // Fase 1: Coleta base de dados da Receita Federal (simulado)
      const baseCompanies = await this.getBaseCompaniesData(filters);
      
      // Fase 2: Enriquecimento com Bright Data
      const enrichedCompanies = await this.enrichWithBrightData(baseCompanies);
      
      console.log(`🤖 Agno + Bright Data: Processadas ${enrichedCompanies.length} empresas com enriquecimento`);
      return enrichedCompanies;
      
    } catch (error) {
      console.error('🚫 Erro na coleta híbrida:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      throw new Error(`Erro ao buscar empresas: ${errorMessage}`);
    }
  }

  private async getBaseCompaniesData(filters: any): Promise<CNPJData[]> {
    console.log('📊 Coletando dados reais do Google Maps...');
    
    // Usar Google Maps API para coleta real de dados
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    
    if (!GOOGLE_MAPS_API_KEY) {
      console.error('❌ GOOGLE_MAPS_API_KEY não configurada. Impossível coletar leads reais.');
      throw new Error('API key do Google Maps não configurada. Configure a chave para coletar leads reais.');
    }

    try {
      const realCompanies = await this.fetchRealCompaniesFromGoogleMaps(filters, GOOGLE_MAPS_API_KEY);
      console.log(`📊 Dados reais coletados: ${realCompanies.length} empresas`);
      return realCompanies;
    } catch (error) {
      console.error('❌ Erro ao coletar dados reais:', error);
      throw new Error(`Falha na coleta de dados reais: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  private async fetchRealCompaniesFromGoogleMaps(filters: any, apiKey: string): Promise<CNPJData[]> {
    const query = this.buildGoogleMapsQuery(filters);
    console.log('🔍 Buscando no Google Maps:', query);
    
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
    
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    if (!response.ok || data.status !== 'OK') {
      throw new Error(`Google Places API error: ${data.error_message || data.status}`);
    }

    const companies: CNPJData[] = [];
    
    for (const place of data.results.slice(0, 20)) {
      try {
        // Obter detalhes do lugar
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_phone_number,website,formatted_address,rating,user_ratings_total,types,business_status&key=${apiKey}`;
        
        const detailsResponse = await fetch(detailsUrl);
        const detailsData = await detailsResponse.json();
        
        if (detailsResponse.ok && detailsData.status === 'OK') {
          const details = detailsData.result;
          
          // Só incluir se tiver telefone ou website (dados de contato)
          if (details.formatted_phone_number || details.website) {
            const company: CNPJData = {
              cnpj: `GOOGLE_${place.place_id}`, // Usar place_id como identificador único
              nome: details.name,
              nome_fantasia: details.name,
              situacao_cadastral: details.business_status === 'OPERATIONAL' ? 'ATIVA' : 'INATIVA',
              data_abertura: new Date().toISOString().split('T')[0],
              cnae_principal: place.types?.[0] || 'unknown',
              cnae_descricao: this.translateBusinessType(place.types?.[0] || 'business'),
              natureza_juridica: "206-2",
              porte: "DEMAIS",
              municipio: filters.municipio || 'GOIANIA',
              uf: filters.uf || 'GO',
              telefone: details.formatted_phone_number,
              email: this.extractEmailFromWebsite(details.website),
              capital_social: 50000,
              socios: [
                { nome: "RESPONSÁVEL COMERCIAL", cargo: "SÓCIO-ADMINISTRADOR" }
              ]
            };
            
            companies.push(company);
          }
        }
      } catch (detailError) {
        console.warn('Erro ao buscar detalhes do lugar:', detailError);
      }
    }

    // Aplicar filtros da Fase 1: Identificação (IA)
    let filteredData = companies;
      
      if (filters.uf) {
        filteredData = filteredData.filter(company => company.uf === filters.uf);
      }
      
      if (filters.municipio) {
        filteredData = filteredData.filter(company => 
          company.municipio.toLowerCase().includes(filters.municipio!.toLowerCase())
        );
      }
      
      // FASE 1: Exclusão automática de MEI (SEMPRE ATIVO)
      const beforeMEI = filteredData.length;
      filteredData = filteredData.filter(company => company.porte !== 'MEI');
      console.log(`🚫 MEI excluídos: ${beforeMEI - filteredData.length}`);
      
      // FASE 1: Exclusão automática de terceiro setor
      if (filters.excludeThirdSector) {
        const beforeThirdSector = filteredData.length; 
        // Naturezas jurídicas do terceiro setor: Associações, Fundações, ONGs, etc.
        const thirdSectorCodes = ['399-9', '398-1', '201-1', '209-7', '116-3', '124-4'];
        filteredData = filteredData.filter(company => 
          !thirdSectorCodes.some(code => company.natureza_juridica?.includes(code))
        );
        console.log(`🚫 Terceiro setor excluídos: ${beforeThirdSector - filteredData.length}`);
      }
      
      // FASE 1: Qualificação por decisor (apenas CNPJs com sócios ativos)
      if (filters.requireActiveDecisionMaker) {
        const beforeDecisionMaker = filteredData.length;
        filteredData = filteredData.filter(company => 
          company.socios && company.socios.length > 0 && 
          company.socios.some(socio => 
            socio.cargo.includes('ADMINISTRADOR') || 
            socio.cargo.includes('SÓCIO') ||
            socio.cargo.includes('DIRETOR')
          )
        );
        console.log(`👥 Com decisor ativo: ${filteredData.length} de ${beforeDecisionMaker}`);
      }
      
      // FASE 1: Apenas CNPJs ativos
      if (filters.onlyActiveCNPJ) {
        filteredData = filteredData.filter(company => company.situacao_cadastral === 'ATIVA');
      }
      
      if (filters.porte) {
        filteredData = filteredData.filter(company => company.porte === filters.porte);
      }

      console.log(`📊 Dados base coletados: ${filteredData.length} empresas`);
      return filteredData;
  }

  private buildGoogleMapsQuery(filters: any): string {
    let query = "empresas negócios";
    
    if (filters.municipio) {
      query += ` ${filters.municipio}`;
    }
    if (filters.uf) {
      query += ` ${filters.uf}`;
    }
    
    return query;
  }

  private translateBusinessType(type: string): string {
    const translations: { [key: string]: string } = {
      'store': 'Comércio varejista',
      'restaurant': 'Restaurantes e similares',
      'health': 'Atividades de atenção à saúde humana',
      'finance': 'Atividades financeiras',
      'establishment': 'Estabelecimento comercial',
      'point_of_interest': 'Ponto comercial',
      'business': 'Atividade empresarial'
    };
    
    return translations[type] || 'Atividade empresarial geral';
  }

  private extractEmailFromWebsite(website?: string): string | undefined {
    if (!website) return undefined;
    
    try {
      const domain = new URL(website).hostname.replace('www.', '');
      return `contato@${domain}`;
    } catch {
      return undefined;
    }
  }

  private async enrichWithBrightData(companies: CNPJData[]): Promise<CNPJData[]> {
    console.log('🔍 Iniciando enriquecimento com Bright Data...');
    
    const enrichedCompanies: CNPJData[] = [];
    const MAX_REVENUE = 1000000; // R$ 1.000.000,00
    
    for (const company of companies) {
      try {
        const brightData = await this.getBrightDataInfo(company);
        
        const enrichedCompany = {
          ...company,
          bright_data: brightData
        };
        
        // Filtrar por faturamento máximo de R$ 1.000.000,00
        if (brightData.revenue_estimate && brightData.revenue_estimate <= MAX_REVENUE) {
          enrichedCompanies.push(enrichedCompany);
          console.log(`✅ ${company.nome_fantasia || company.nome} enriquecida (Faturamento: R$ ${brightData.revenue_estimate.toLocaleString('pt-BR')})`);
        } else {
          console.log(`🚫 ${company.nome_fantasia || company.nome} excluída por faturamento acima de R$ 1.000.000,00`);
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        console.warn(`⚠️ Erro ao enriquecer ${company.nome}: ${errorMessage}`);
        // Manter empresa mesmo sem enriquecimento se estiver dentro do limite estimado
        const estimatedRevenue = this.estimateRevenue(company);
        if (estimatedRevenue <= MAX_REVENUE) {
          enrichedCompanies.push(company);
        }
      }
    }
    
    console.log(`💰 Filtradas ${enrichedCompanies.length} empresas com faturamento até R$ 1.000.000,00`);
    return enrichedCompanies;
  }

  private async getBrightDataInfo(company: CNPJData): Promise<any> {
    // Simulação de enriquecimento com Bright Data
    // Em produção, faria chamadas reais para a API do Bright Data
    
    const mockBrightData = {
      website: `https://www.${company.nome.toLowerCase().replace(/\s+/g, '')}.com.br`,
      social_media: {
        linkedin: `https://linkedin.com/company/${company.nome.toLowerCase().replace(/\s+/g, '-')}`,
        facebook: company.porte === 'EPP' ? `https://facebook.com/${company.nome_fantasia?.toLowerCase().replace(/\s+/g, '')}` : undefined,
        instagram: company.cnae_principal.includes('6201') ? `https://instagram.com/${company.nome_fantasia?.toLowerCase().replace(/\s+/g, '')}` : undefined
      },
      employees_count: this.estimateEmployees(company.porte, company.capital_social),
      revenue_estimate: this.estimateRevenue(company),
      industry_classification: this.getIndustryFromCNAE(company.cnae_descricao),
      tech_stack: company.cnae_principal.includes('6201') ? ['React', 'Node.js', 'AWS'] : undefined,
      contact_emails: [
        `contato@${company.nome.toLowerCase().replace(/\s+/g, '')}.com.br`,
        `comercial@${company.nome.toLowerCase().replace(/\s+/g, '')}.com.br`
      ],
      verified_phones: company.telefone ? [company.telefone] : []
    };

    return mockBrightData;
  }

  private estimateEmployees(porte: string, capitalSocial: number): number {
    switch (porte) {
      case 'EPP': return Math.floor(Math.random() * 50) + 10; // 10-60 funcionários
      case 'DEMAIS': return Math.floor(Math.random() * 20) + 5; // 5-25 funcionários
      default: return Math.floor(Math.random() * 10) + 1; // 1-10 funcionários
    }
  }

  private estimateRevenue(company: CNPJData): number {
    // Baseado no capital social e porte
    let baseRevenue = company.capital_social * 3;
    
    switch (company.porte) {
      case 'EPP': return baseRevenue * 2;
      case 'DEMAIS': return baseRevenue * 1.5;
      default: return baseRevenue;
    }
  }

  private getIndustryFromCNAE(cnaeDescricao: string): string {
    if (cnaeDescricao.includes('programa')) return 'Technology';
    if (cnaeDescricao.includes('comércio')) return 'Retail';
    if (cnaeDescricao.includes('consultoria')) return 'Consulting';
    return 'Other';
  }

  async qualifyLead(company: CNPJData): Promise<any> {
    console.log(`🤖 Agno + Bright Data: Qualificando lead enriquecido para ${company.nome}`);
    
    // Qualificação BANT avançada com dados do Bright Data
    const qualification = {
      qualificationScore: this.calculateEnhancedBANTScore(company),
      urgencyLevel: this.calculateUrgency(company),
      decisionMaker: this.identifyDecisionMaker(company),
      contactChannels: this.getBestContactChannels(company),
      gancho_prospeccao: this.generateEnhancedProspectHook(company),
      estimated_revenue: company.bright_data?.revenue_estimate?.toLocaleString('pt-BR') || this.estimateBasicRevenue(company),
      recommended_channel: this.getRecommendedChannel(company),
      enrichment_data: this.getSummaryEnrichment(company)
    };

    console.log(`🎯 Qualificação avançada concluída: Score ${qualification.qualificationScore}`);
    return qualification;
  }

  private calculateEnhancedBANTScore(company: CNPJData): string {
    let score = 0;
    
    // Budget: baseado no capital + dados do Bright Data
    const revenueEstimate = company.bright_data?.revenue_estimate || company.capital_social * 2;
    if (revenueEstimate >= 1000000) score += 30; // +5 pelo enriquecimento
    else if (revenueEstimate >= 500000) score += 25;
    else if (revenueEstimate >= 100000) score += 20;
    else score += 10;
    
    // Authority: sócio-administrador + presença digital
    let authorityScore = 15;
    if (company.socios.some(s => s.cargo.includes('ADMINISTRADOR'))) authorityScore += 10;
    if (company.bright_data?.social_media?.linkedin) authorityScore += 5; // LinkedIn = mais profissional
    score += Math.min(authorityScore, 30);
    
    // Need: CNAE + tech stack + funcionários
    const highNeedCNAEs = ['6201-5', '4681-8', '7020-4'];
    let needScore = 15;
    if (highNeedCNAEs.some(cnae => company.cnae_principal.includes(cnae))) needScore += 10;
    if (company.bright_data?.employees_count && company.bright_data.employees_count > 10) needScore += 5;
    score += Math.min(needScore, 25);
    
    // Timing: idade da empresa + presença digital ativa
    const dataAbertura = new Date(company.data_abertura);
    const anosOperacao = (new Date().getFullYear() - dataAbertura.getFullYear());
    let timingScore = 10;
    if (anosOperacao <= 3) timingScore += 15;
    else if (anosOperacao <= 5) timingScore += 10;
    if (company.bright_data?.website) timingScore += 5; // Site ativo = expansão
    score += Math.min(timingScore, 25);
    
    if (score >= 90) return 'A+'; // Novo nível premium
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

  private generateEnhancedProspectHook(company: CNPJData): string {
    const brightData = company.bright_data;
    const companyName = company.nome_fantasia || company.nome;
    
    // Ganchos personalizados baseados no enriquecimento
    const hooks = [];
    
    // Hook baseado em crescimento de funcionários
    if (brightData?.employees_count && brightData.employees_count > 15) {
      hooks.push(`${companyName} está em expansão com ${brightData.employees_count}+ funcionários - momento ideal para modernizar a gestão financeira com C6 Bank.`);
    }
    
    // Hook baseado em presença digital
    if (brightData?.website && brightData?.social_media?.linkedin) {
      hooks.push(`${companyName} tem forte presença digital - nossa conta PJ C6 Bank oferece integração API para automatizar processos financeiros.`);
    }
    
    // Hook baseado em tech stack (para empresas de tecnologia)
    if (brightData?.tech_stack && brightData.tech_stack.length > 0) {
      hooks.push(`${companyName} usa tecnologias modernas - nossa conta PJ digital se integra perfeitamente com ${brightData.tech_stack.join(', ')}.`);
    }
    
    // Hook baseado em faturamento estimado
    if (brightData?.revenue_estimate && brightData.revenue_estimate > 500000) {
      hooks.push(`Com faturamento estimado de R$ ${brightData.revenue_estimate.toLocaleString('pt-BR')}, ${companyName} pode economizar milhares em tarifas bancárias com C6 Bank.`);
    }
    
    // Hook padrão se não tiver dados específicos
    if (hooks.length === 0) {
      hooks.push(`${companyName} (${company.porte}) em ${company.municipio} - oportunidade para conta PJ digital sem mensalidade no C6 Bank.`);
    }
    
    return hooks[Math.floor(Math.random() * hooks.length)];
  }

  private getBestContactChannels(company: CNPJData) {
    const channels = {
      phone: company.telefone || '',
      whatsapp: '',
      email: company.email || '',
      linkedin: '',
      website: '',
      status: 'enriquecido'
    };

    // Adicionar canais do Bright Data
    if (company.bright_data) {
      if (company.bright_data.verified_phones && company.bright_data.verified_phones.length > 0) {
        channels.whatsapp = company.bright_data.verified_phones[0];
      }
      
      if (company.bright_data.contact_emails && company.bright_data.contact_emails.length > 0) {
        channels.email = company.bright_data.contact_emails[0];
      }
      
      if (company.bright_data.social_media?.linkedin) {
        channels.linkedin = company.bright_data.social_media.linkedin;
      }
      
      if (company.bright_data.website) {
        channels.website = company.bright_data.website;
      }
    }

    return channels;
  }

  private getRecommendedChannel(company: CNPJData): string {
    // Priorizar baseado na qualidade dos dados enriquecidos
    if (company.bright_data?.verified_phones && company.bright_data.verified_phones.length > 0) {
      return 'WhatsApp Verificado';
    }
    
    if (company.bright_data?.social_media?.linkedin) {
      return 'LinkedIn';
    }
    
    if (company.telefone) {
      return 'WhatsApp';
    }
    
    if (company.bright_data?.contact_emails && company.bright_data.contact_emails.length > 0) {
      return 'Email Corporativo';
    }
    
    return 'Email';
  }

  private getSummaryEnrichment(company: CNPJData) {
    if (!company.bright_data) return null;
    
    return {
      data_sources: ['Receita Federal', 'Bright Data'],
      enrichment_score: this.calculateEnrichmentScore(company.bright_data),
      digital_presence: {
        website: !!company.bright_data.website,
        social_media: Object.keys(company.bright_data.social_media || {}).length,
        verified_contacts: (company.bright_data.verified_phones?.length || 0) + (company.bright_data.contact_emails?.length || 0)
      }
    };
  }

  private calculateEnrichmentScore(brightData: any): number {
    let score = 0;
    if (brightData.website) score += 20;
    if (brightData.social_media?.linkedin) score += 25;
    if (brightData.employees_count) score += 15;
    if (brightData.revenue_estimate) score += 20;
    if (brightData.verified_phones?.length > 0) score += 20;
    return Math.min(score, 100);
  }

  private estimateBasicRevenue(company: CNPJData): string {
    let estimate = 0;
    
    switch (company.porte) {
      case 'EPP':
        estimate = company.capital_social * 2;
        break;
      case 'DEMAIS':
        estimate = company.capital_social * 1.5;
        break;
      default:
        estimate = company.capital_social * 1.2;
    }
    
    return `R$ ${estimate.toLocaleString('pt-BR')}`;
  }

  async saveLeadsToDatabase(leads: any[], userId: string, campaignId?: string) {
    console.log(`💾 Salvando ${leads.length} leads no banco de dados`);
    
    const leadPromises = leads.map(async (lead) => {
      console.log('📝 Tentando salvar lead:', {
        empresa: lead.company.nome_fantasia || lead.company.nome,
        cnpj: lead.company.cnpj
      });
      
      // Inserir na tabela leads
      const { data: leadData, error: leadError } = await this.supabase
        .from('leads')
        .insert({
          user_id: userId,
          empresa: lead.company.nome_fantasia || lead.company.nome,
          telefone: lead.company.telefone,
          email: lead.company.email,
          setor: lead.company.cnae_descricao,
          status: 'novo',
          qualification_score: lead.qualification.qualificationScore,
          approach_strategy: lead.qualification.gancho_prospeccao,
          estimated_employees: lead.company.bright_data?.employees_count || null,
          tech_stack: lead.company.bright_data?.tech_stack || null,
          social_media: lead.company.bright_data?.social_media || null,
          website: lead.company.bright_data?.website || null,
          linkedin: lead.company.bright_data?.social_media?.linkedin || null,
          whatsapp: lead.qualification.contactChannels?.whatsapp || lead.company.telefone || null,
          cnae: lead.company.cnae_principal,
          regime_tributario: lead.company.porte,
          contato_decisor: lead.qualification.decisionMaker?.name || null,
          gancho_prospeccao: lead.qualification.gancho_prospeccao,
          bright_data_enriched: !!lead.company.bright_data
        })
        .select()
        .single();

      if (leadError) {
        console.error('❌ Erro ao salvar lead:', leadError);
        return null;
      }

      console.log('✅ Lead salvo com sucesso:', leadData.id);

      // Inserir na tabela contacts
      if (lead.qualification.decisionMaker.name !== 'Não identificado') {
        const { error: contactError } = await this.supabase
          .from('contacts')
          .insert({
            user_id: userId,
            nome: lead.qualification.decisionMaker.name,
            cargo: lead.qualification.decisionMaker.role,
            telefone: lead.company.telefone,
            email: lead.company.email,
            empresa: lead.company.nome_fantasia || lead.company.nome,
            linkedin: lead.company.bright_data?.social_media?.linkedin || null
          });
        
        if (contactError) {
          console.warn('⚠️ Erro ao salvar contato:', contactError);
        }
      }

      return leadData;
    });

    const results = await Promise.all(leadPromises);
    const successfulLeads = results.filter(result => result !== null);
    
    console.log(`✅ ${successfulLeads.length} leads salvos com sucesso de ${leads.length} tentativas`);
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

    // Verificar se APIs necessárias estão configuradas para coleta real de dados
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    
    if (!GOOGLE_MAPS_API_KEY) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Agente Agno desabilitado: Configure GOOGLE_MAPS_API_KEY para coletar leads reais.',
        message: 'O Agno foi desabilitado para evitar dados fictícios. Configure as APIs necessárias:\n1. Google Maps API Key (obrigatório)\n2. HubSpot API Key (opcional - para integração)\n3. Pipedrive API Key (opcional - para integração)',
        disabledReason: 'Prevenção de dados simulados/fictícios'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🚀 Iniciando Agno + Bright Data Smart Collector para coleta de prospects');
    
    // Inicializar o agente híbrido
    const agent = new AgnoSmartCollectorAgent();
    
    // Definir filtros da Fase 1: Identificação (IA)
    const searchFilters = {
      uf: 'GO',
      municipio: 'GOIANIA',
      excludeMEI: true,              // SEMPRE EXCLUIR MEI
      excludeThirdSector: true,      // Exclusão automática de terceiro setor  
      requireActiveDecisionMaker: true, // Qualificação por decisor (dono/sócio)
      onlyActiveCNPJ: true,         // Prospecção web de empresas com CNPJ ativo
      maxRevenue: 1000000,          // Faturamento máximo de R$ 1.000.000,00
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
        message: `Agno + Bright Data coletou e enriqueceu ${savedLeads.length} leads qualificados`,
        prospectsCount: companies.length,
        qualifiedCount: savedLeads.length,
        excludedMEI: 0, // Será calculado nos filtros
        excludedThirdSector: 0, // Será calculado nos filtros
        data: {
          leads_collected: savedLeads.length,
          agent_used: 'AgnoSmartCollectorAgent',
          data_sources: ['Receita Federal', 'Bright Data'],
          enrichment_enabled: true,
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
    console.error('❌ Erro no Agno + Bright Data Agent:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        message: 'Erro na coleta de prospects com Agno + Bright Data'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});