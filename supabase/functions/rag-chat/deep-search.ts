import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export async function performDeepRAGSearch(query: string, userId: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    // Buscar leads com filtro inteligente
    const { data: leads } = await supabase
      .from('leads')
      .select('*')
      .eq('user_id', userId)
      .or(`empresa.ilike.%${query}%,setor.ilike.%${query}%,gancho_prospeccao.ilike.%${query}%`)
      .limit(10);

    // Buscar contatos relevantes
    const { data: contacts } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .or(`nome.ilike.%${query}%,empresa.ilike.%${query}%,cargo.ilike.%${query}%`)
      .limit(10);

    // Buscar campanhas
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('*, campaign_scripts(*)')
      .eq('user_id', userId)
      .limit(5);

    // Buscar oportunidades
    const { data: opportunities } = await supabase
      .from('opportunities')
      .select('*')
      .eq('user_id', userId)
      .or(`titulo.ilike.%${query}%,empresa.ilike.%${query}%`)
      .limit(10);

    // Buscar interações recentes
    const { data: interactions } = await supabase
      .from('interactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    // Estatísticas gerais
    const { data: allLeads } = await supabase
      .from('leads')
      .select('status')
      .eq('user_id', userId);

    const totalLeads = allLeads?.length || 0;
    const qualifiedLeads = allLeads?.filter(l => l.status === 'qualificado').length || 0;
    const activeCampaigns = campaigns?.filter(c => c.status === 'ativa').length || 0;

    return {
      totalLeads,
      qualifiedLeads,
      activeCampaigns,
      relevantData: {
        leads: leads || [],
        contacts: contacts || [],
        campaigns: campaigns || [],
        opportunities: opportunities || [],
        interactions: interactions || []
      },
      recentInteractions: interactions?.map(i => `${i.tipo}: ${i.assunto} (${new Date(i.created_at).toLocaleDateString('pt-BR')})`).join(', ') || 'Nenhuma interação recente'
    };
  } catch (error) {
    console.error('Erro no deep search:', error);
    return {
      totalLeads: 0,
      qualifiedLeads: 0,
      activeCampaigns: 0,
      relevantData: {
        leads: [],
        contacts: [],
        campaigns: [],
        opportunities: [],
        interactions: []
      },
      recentInteractions: 'Erro ao carregar interações'
    };
  }
}