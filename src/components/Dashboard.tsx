import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatsCard from "./StatsCard";
import InAppCommunication from "./InAppCommunication";
import UpgradeModal from "./UpgradeModal";
import LeadQualificationEngine from "./LeadQualificationEngine";
import { CampaignScheduler } from "./CampaignScheduler";
import { DailyCompaniesManager } from "./CRM/DailyCompaniesManager";
import { useUserPlan } from "./UserPlanProvider";
import { 
  Users, 
  Calendar, 
  Target, 
  TrendingUp, 
  Phone, 
  Mail,
  MessageSquare,
  Bot,
  Settings,
  LogOut,
  Smartphone,
  Search,
  Zap,
  Clock,
  Building2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const userPlan = useUserPlan();
  const [dashboardStats, setDashboardStats] = useState({
    prospectsAtivos: 0,
    reunioesAgendadas: 0,
    taxaConversao: 0,
    receitaPipeline: 0,
    previousProspects: 0,
    previousReunioes: 0,
    previousTaxa: 0,
    previousReceita: 0
  });
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showQualificationEngine, setShowQualificationEngine] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [showDailyCompanies, setShowDailyCompanies] = useState(false);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Buscar leads (prospects ativos) - usar paginação para todos os leads
      let allLeads: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      console.log('🔄 Dashboard: Iniciando carregamento paginado de leads...');
      
      while (hasMore) {
        console.log(`📄 Buscando página: from=${from}, até=${from + pageSize - 1}`);
        const { data, error } = await supabase
          .from('leads')
          .select('*')
          .eq('user_id', user.id)
          .range(from, from + pageSize - 1);
        
        if (error) {
          console.error('❌ Erro ao buscar página de leads:', error);
          throw error;
        }
        
        console.log(`✅ Página carregada: ${data?.length || 0} leads`);
        
        if (data && data.length > 0) {
          allLeads = [...allLeads, ...data];
          from += pageSize;
          hasMore = data.length === pageSize;
          console.log(`📊 Total acumulado: ${allLeads.length} leads, hasMore: ${hasMore}`);
        } else {
          hasMore = false;
          console.log('🏁 Não há mais leads para carregar');
        }
      }
      
      const leadsData = allLeads;
      console.log(`\n✅ DASHBOARD FINAL: ${leadsData.length} leads carregados\n`);

      // Buscar oportunidades
      const { data: opportunitiesData } = await supabase
        .from('opportunities')
        .select('*')
        .eq('user_id', user.id);

      // Buscar interações recentes
      const { data: interactionsData } = await supabase
        .from('interactions')
        .select('*, contact_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(4);

      // Buscar contatos para as interações
      const contactIds = interactionsData?.map(i => i.contact_id).filter(Boolean) || [];
      const { data: contactsData } = await supabase
        .from('contacts')
        .select('*')
        .in('id', contactIds);

      // Calcular métricas
      const prospectsAtivos = leadsData?.filter(l => l.status !== 'perdido').length || 0;
      const reunioesAgendadas = opportunitiesData?.filter(o => o.estagio === 'reuniao').length || 0;
      
      const totalOportunidades = opportunitiesData?.length || 0;
      const fechamentos = opportunitiesData?.filter(o => o.estagio === 'fechamento').length || 0;
      const taxaConversao = totalOportunidades > 0 ? (fechamentos / totalOportunidades) * 100 : 0;
      
      const receitaPipeline = opportunitiesData?.reduce((acc, opp) => {
        return acc + (Number(opp.valor) || 0);
      }, 0) || 0;

      // Para simulação de trends (em produção seria comparação com período anterior)
      const previousProspects = Math.round(prospectsAtivos * 0.9);
      const previousReunioes = Math.round(reunioesAgendadas * 0.92);
      const previousTaxa = Math.round(taxaConversao * 0.95 * 100) / 100;
      const previousReceita = Math.round(receitaPipeline * 0.77);

      setDashboardStats({
        prospectsAtivos,
        reunioesAgendadas,
        taxaConversao,
        receitaPipeline,
        previousProspects,
        previousReunioes,
        previousTaxa,
        previousReceita
      });

      // Mapear atividades recentes
      const activities = interactionsData?.map(interaction => {
        const contact = contactsData?.find(c => c.id === interaction.contact_id);
        const timeAgo = interaction.created_at ? 
          formatDistanceToNow(new Date(interaction.created_at), { 
            addSuffix: true, 
            locale: ptBR 
          }) : 'agora';

        return {
          type: interaction.tipo?.toLowerCase() || 'message',
          prospect: contact?.nome || 'Prospect',
          company: contact?.empresa || 'Empresa',
          time: timeAgo
        };
      }) || [];

      setRecentActivities(activities);

    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `R$ ${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(0)}k`;
    } else {
      return `R$ ${value.toFixed(0)}`;
    }
  };

  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0) return { trend: "0%", trendUp: true };
    const change = ((current - previous) / previous) * 100;
    return {
      trend: `${change > 0 ? '+' : ''}${change.toFixed(1)}%`,
      trendUp: change >= 0
    };
  };

  const stats = [
    {
      title: "Prospects Ativos",
      value: loading ? "..." : dashboardStats.prospectsAtivos.toLocaleString('pt-BR'),
      icon: Users,
      ...calculateTrend(dashboardStats.prospectsAtivos, dashboardStats.previousProspects)
    },
    {
      title: "Reuniões Agendadas",
      value: loading ? "..." : dashboardStats.reunioesAgendadas.toString(),
      icon: Calendar,
      gradient: true,
      ...calculateTrend(dashboardStats.reunioesAgendadas, dashboardStats.previousReunioes)
    },
    {
      title: "Taxa de Conversão",
      value: loading ? "..." : `${dashboardStats.taxaConversao.toFixed(1)}%`,
      icon: Target,
      ...calculateTrend(dashboardStats.taxaConversao, dashboardStats.previousTaxa)
    },
    {
      title: "Receita Pipeline",
      value: loading ? "..." : formatCurrency(dashboardStats.receitaPipeline),
      icon: TrendingUp,
      ...calculateTrend(dashboardStats.receitaPipeline, dashboardStats.previousReceita)
    }
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'ligacao':
      case 'call': 
        return <Phone className="h-4 w-4" />;
      case 'email': 
        return <Mail className="h-4 w-4" />;
      case 'reuniao':
      case 'meeting': 
        return <Calendar className="h-4 w-4" />;
      case 'whatsapp':
      case 'message': 
        return <MessageSquare className="h-4 w-4" />;
      default: 
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with User Info */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Bem-vindo ao LEADOS AI Pro, {user?.email?.split('@')[0]}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Configurações
          </Button>
          <Button variant="outline" size="sm" onClick={() => signOut()}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </div>

      {/* In-App Communication */}
      <InAppCommunication
        userPlan={userPlan.plan}
        leadsUsed={userPlan.leadsUsed}
        leadsLimit={userPlan.leadsLimit}
        trialDaysLeft={userPlan.trialDaysLeft}
        onUpgrade={() => setShowUpgradeModal(true)}
      />

      {/* Hero Section - Updated */}
      <div className="relative overflow-hidden bg-gradient-primary rounded-2xl p-8 text-white shadow-large">
        <div className="relative z-10">
          <h2 className="text-3xl font-bold mb-2">LEADOS AI Pro</h2>
          <p className="text-white/80 mb-6 max-w-2xl">
            Sua ferramenta de IA para prospecção inteligente e agendamento automático de reuniões. 
            Foque em fechar, não em procurar.
          </p>
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-primary/90 to-primary-glow/90"></div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <StatsCard key={index} {...stat} />
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Atividades Recentes */}
        <Card className="lg:col-span-2 shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Atividades Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities.length > 0 ? (
                recentActivities.map((activity, index) => (
                  <div key={index} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="p-2 rounded-full bg-primary/10">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{activity.prospect}</p>
                      <p className="text-sm text-muted-foreground">{activity.company}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{activity.time}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <TrendingUp className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma atividade recente</p>
                  <p className="text-sm text-muted-foreground">Comece criando interações com seus contatos</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* RAG Chat IA */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-accent" />
              RAG Assistant IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-gradient-success text-white">
                <p className="text-sm font-medium mb-2">🤖 LEADOS Consultor Inteligente</p>
                <p className="text-sm text-white/90">
                  LEADOS Consultor inteligente via WhatsApp.
                </p>
              </div>
              <Button 
                className="w-full mb-2" 
                variant="outline"
                onClick={() => window.dispatchEvent(new CustomEvent('openWhatsAppConnector'))}
              >
                <Smartphone className="h-4 w-4 mr-2" />
                Conectar WhatsApp
              </Button>
              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => window.dispatchEvent(new CustomEvent('openWhatsAppDashboard'))}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Iniciar Atendimento WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lead Qualification Engine Section */}
      {showQualificationEngine && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Motor de Qualificação de Leads</h2>
            <Button variant="outline" onClick={() => setShowQualificationEngine(false)}>
              Fechar
            </Button>
          </div>
          <LeadQualificationEngine />
        </div>
      )}

      {/* Campaign Scheduler Section */}
      {showScheduler && user && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Agendamento Inteligente de Mensagens</h2>
            <Button variant="outline" onClick={() => setShowScheduler(false)}>
              Fechar
            </Button>
          </div>
          <CampaignScheduler userId={user.id} />
        </div>
      )}

      {/* Daily Companies Section */}
      {showDailyCompanies && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Novas Empresas - Ingestão Diária</h2>
            <Button variant="outline" onClick={() => setShowDailyCompanies(false)}>
              Fechar
            </Button>
          </div>
          <DailyCompaniesManager />
        </div>
      )}

      {/* Quick Actions */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Ações Rápidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <Button 
              className="h-auto p-4 flex flex-col items-center gap-2" 
              variant="outline"
              onClick={() => setShowQualificationEngine(!showQualificationEngine)}
            >
              <Search className="h-6 w-6" />
              <div className="text-center">
                <div className="font-medium">Motor de Qualificação</div>
                <div className="text-sm text-muted-foreground">Enriquecer e qualificar leads</div>
              </div>
            </Button>
            <Button 
              className="h-auto p-4 flex flex-col items-center gap-2" 
              variant="outline"
              onClick={() => setShowDailyCompanies(!showDailyCompanies)}
            >
              <Building2 className="h-6 w-6" />
              <div className="text-center">
                <div className="font-medium">Novas Empresas</div>
                <div className="text-sm text-muted-foreground">Ingestão diária</div>
              </div>
            </Button>
            <Button 
              className="h-auto p-4 flex flex-col items-center gap-2" 
              variant="outline"
              onClick={() => window.dispatchEvent(new CustomEvent('openWhatsAppConnector'))}
            >
              <Smartphone className="h-6 w-6" />
              <div className="text-center">
                <div className="font-medium">WhatsApp</div>
                <div className="text-sm text-muted-foreground">Conectar e configurar</div>
              </div>
            </Button>
            <Button 
              className="h-auto p-4 flex flex-col items-center gap-2 bg-gradient-to-br from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 border-0" 
              onClick={() => window.dispatchEvent(new CustomEvent('openCampaignTest'))}
            >
              <Zap className="h-6 w-6" />
              <div className="text-center">
                <div className="font-medium">🧪 Testar Campanha</div>
                <div className="text-sm opacity-90">Evolution + N8N + CRM</div>
              </div>
            </Button>
            <Button 
              className="h-auto p-4 flex flex-col items-center gap-2" 
              variant="outline"
              onClick={() => window.dispatchEvent(new CustomEvent('openCampaignManager'))}
            >
              <Target className="h-6 w-6" />
              <div className="text-center">
                <div className="font-medium">Campanhas</div>
                <div className="text-sm text-muted-foreground">Gerenciar e criar</div>
              </div>
            </Button>
            <Button 
              className="h-auto p-4 flex flex-col items-center gap-2" 
              variant="outline"
              onClick={() => setShowScheduler(!showScheduler)}
            >
              <Clock className="h-6 w-6" />
              <div className="text-center">
                <div className="font-medium">Agendamento</div>
                <div className="text-sm text-muted-foreground">1000 disparos/dia</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>


      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentPlan={userPlan.plan}
      />
    </div>
  );
};

export default Dashboard;