// Base de conhecimento dinâmica com dados do CRM
import { supabase } from "@/integrations/supabase/client";

export interface Target {
  empresa: string;
  setor: string;
  cnae: string;
  regime_tributario: string;
  contato_decisor: string;
  telefone: string;
  email: string;
  website: string;
  gancho_prospeccao: string;
}

export interface CallScript {
  empresa: string;
  roteiro_ligacao: string;
  modelo_email: string;
  assunto_email?: string;
}

export interface CampaignData {
  id: string;
  name: string;
  targets: Target[];
  scripts: CallScript[];
  status: string;
  created_at: string;
}

// Buscar dados atualizados do CRM
export async function getTargetsFromCRM(userId: string): Promise<Target[]> {
  try {
    const { data: leads, error } = await supabase
      .from('leads')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['novo', 'qualificado', 'contatado']);

    if (error) throw error;

    return leads?.map(lead => ({
      empresa: lead.empresa || '',
      setor: lead.setor || '',
      cnae: lead.cnae || '',
      regime_tributario: lead.regime_tributario || '',
      contato_decisor: lead.contato_decisor || '',
      telefone: lead.telefone || '',
      email: lead.email || '',
      website: lead.website || '',
      gancho_prospeccao: lead.gancho_prospeccao || ''
    })) || [];
  } catch (error) {
    console.error('Erro ao buscar targets do CRM:', error);
    return [];
  }
}

export async function getCallScriptsFromCRM(userId: string): Promise<CallScript[]> {
  try {
    const { data: campaigns, error } = await supabase
      .from('campaign_scripts')
      .select(`
        empresa,
        roteiro_ligacao,
        modelo_email,
        assunto_email,
        campaigns!inner(user_id)
      `)
      .eq('campaigns.user_id', userId);

    if (error) throw error;

    return campaigns?.map(script => ({
      empresa: script.empresa,
      roteiro_ligacao: script.roteiro_ligacao,
      modelo_email: script.modelo_email,
      assunto_email: script.assunto_email
    })) || [];
  } catch (error) {
    console.error('Erro ao buscar scripts do CRM:', error);
    return [];
  }
}

export async function getCampaignKnowledge(userId: string): Promise<CampaignData[]> {
  try {
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        campaign_scripts(*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const campaignData: CampaignData[] = [];

    for (const campaign of campaigns || []) {
      const targets = await getTargetsFromCRM(userId);
      const scripts = campaign.campaign_scripts?.map(script => ({
        empresa: script.empresa,
        roteiro_ligacao: script.roteiro_ligacao,
        modelo_email: script.modelo_email,
        assunto_email: script.assunto_email
      })) || [];

      campaignData.push({
        id: campaign.id,
        name: campaign.name,
        targets: targets.filter(t => campaign.target_companies.includes(t.empresa)),
        scripts,
        status: campaign.status,
        created_at: campaign.created_at
      });
    }

    return campaignData;
  } catch (error) {
    console.error('Erro ao buscar conhecimento de campanhas:', error);
    return [];
  }
}

// Salvar conhecimento em arquivo TXT
export async function saveKnowledgeToFile(userId: string): Promise<string> {
  try {
    const targets = await getTargetsFromCRM(userId);
    const scripts = await getCallScriptsFromCRM(userId);
    const campaigns = await getCampaignKnowledge(userId);

    let content = `# KNOWLEDGE BASE - CAMPANHAS DE PROSPECÇÃO\n`;
    content += `# Gerado em: ${new Date().toLocaleDateString('pt-BR')}\n\n`;

    content += `## TARGETS ATIVOS (${targets.length})\n`;
    content += `=================================\n\n`;
    
    for (const target of targets) {
      content += `Empresa: ${target.empresa}\n`;
      content += `Setor: ${target.setor}\n`;
      content += `CNAE: ${target.cnae}\n`;
      content += `Regime: ${target.regime_tributario}\n`;
      content += `Decisor: ${target.contato_decisor}\n`;
      content += `Email: ${target.email}\n`;
      content += `Telefone: ${target.telefone}\n`;
      content += `Website: ${target.website}\n`;
      content += `Gancho: ${target.gancho_prospeccao}\n`;
      content += `${'='.repeat(50)}\n\n`;
    }

    content += `## SCRIPTS DE PROSPECÇÃO (${scripts.length})\n`;
    content += `=================================\n\n`;
    
    for (const script of scripts) {
      content += `Empresa: ${script.empresa}\n`;
      content += `Roteiro de Ligação:\n${script.roteiro_ligacao}\n\n`;
      content += `Modelo de E-mail:\n${script.modelo_email}\n`;
      content += `${'='.repeat(50)}\n\n`;
    }

    content += `## CAMPANHAS ATIVAS (${campaigns.length})\n`;
    content += `=================================\n\n`;
    
    for (const campaign of campaigns) {
      content += `ID: ${campaign.id}\n`;
      content += `Nome: ${campaign.name}\n`;
      content += `Status: ${campaign.status}\n`;
      content += `Criada em: ${new Date(campaign.created_at).toLocaleDateString('pt-BR')}\n`;
      content += `Targets: ${campaign.targets.length}\n`;
      content += `Scripts: ${campaign.scripts.length}\n`;
      content += `${'='.repeat(50)}\n\n`;
    }

    // Salvar conhecimento histórico (removido temporariamente até o types.ts ser atualizado)
    // await supabase
    //   .from('campaign_knowledge')
    //   .upsert({
    //     user_id: userId,
    //     content,
    //     generated_at: new Date().toISOString()
    //   });

    return content;
  } catch (error) {
    console.error('Erro ao salvar knowledge base:', error);
    return '';
  }
}

// Função para buscar alvos por palavra-chave (versão dinâmica)
export async function searchTargets(query: string, userId: string): Promise<Target[]> {
  const targets = await getTargetsFromCRM(userId);
  const searchTerm = query.toLowerCase();
  return targets.filter(target => 
    target.empresa.toLowerCase().includes(searchTerm) ||
    target.setor.toLowerCase().includes(searchTerm) ||
    target.gancho_prospeccao.toLowerCase().includes(searchTerm)
  );
}

// Função para obter roteiro por empresa (versão dinâmica)
export async function getCallScript(empresa: string, userId: string): Promise<CallScript | undefined> {
  const scripts = await getCallScriptsFromCRM(userId);
  return scripts.find(script => 
    script.empresa.toLowerCase().includes(empresa.toLowerCase())
  );
}

// Função RAG para buscar informações relevantes (versão aprimorada)
export async function performRAGSearch(query: string, userId: string): Promise<{ 
  targets: Target[], 
  scripts: CallScript[], 
  suggestions: string[],
  campaigns: CampaignData[],
  contacts: any[],
  leads: any[]
}> {
  const queryLower = query.toLowerCase();
  
  // Buscar dados do CRM
  const [targets, scripts, campaigns] = await Promise.all([
    getTargetsFromCRM(userId),
    getCallScriptsFromCRM(userId),
    getCampaignKnowledge(userId)
  ]);

  // Buscar contatos relevantes
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('user_id', userId)
    .or(`nome.ilike.%${queryLower}%,empresa.ilike.%${queryLower}%,cargo.ilike.%${queryLower}%`);

  // Buscar leads relevantes
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('user_id', userId)
    .or(`empresa.ilike.%${queryLower}%,setor.ilike.%${queryLower}%,gancho_prospeccao.ilike.%${queryLower}%`);

  // Filtrar alvos relevantes
  const relevantTargets = targets.filter(target => 
    target.empresa.toLowerCase().includes(queryLower) ||
    target.setor.toLowerCase().includes(queryLower) ||
    target.gancho_prospeccao.toLowerCase().includes(queryLower) ||
    queryLower.includes(target.empresa.toLowerCase().split(' ')[0])
  );

  // Filtrar scripts relevantes
  const relevantScripts = scripts.filter(script =>
    script.empresa.toLowerCase().includes(queryLower) ||
    queryLower.includes(script.empresa.toLowerCase())
  );

  // Gerar sugestões inteligentes baseadas no contexto
  const suggestions = [];
  if (queryLower.includes('lead') || queryLower.includes('prospect')) {
    suggestions.push('Qualificação BANT para leads B2B', 'Estratégias de abordagem por setor', 'Follow-up automático');
  }
  if (queryLower.includes('tributário') || queryLower.includes('fiscal')) {
    suggestions.push('Recuperação de créditos ICMS', 'Compliance tributário', 'Planejamento fiscal');
  }
  if (queryLower.includes('reunião') || queryLower.includes('meeting')) {
    suggestions.push('Melhores horários para contato', 'Scripts de agendamento', 'Follow-up pós reunião');
  }
  if (queryLower.includes('campanha')) {
    suggestions.push('Disparar nova campanha WhatsApp', 'Enviar e-mails em massa', 'Agendar follow-ups');
  }
  if (queryLower.includes('whatsapp')) {
    suggestions.push('Templates de mensagem WhatsApp', 'Automação de envio', 'Tracking de respostas');
  }

  return { 
    targets: relevantTargets, 
    scripts: relevantScripts, 
    suggestions,
    campaigns,
    contacts: contacts || [],
    leads: leads || []
  };
}