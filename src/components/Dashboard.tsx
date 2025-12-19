import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import StatsCard from "./StatsCard";
import InAppCommunication from "./InAppCommunication";
import UpgradeModal from "./UpgradeModal";
import LeadQualificationEngine from "./LeadQualificationEngine";
import { CampaignScheduler } from "./CampaignScheduler";
import { DailyCompaniesManager } from "./CRM/DailyCompaniesManager";
import { useUserPlan } from "./UserPlanProvider";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
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
  Building2,
  Brain,
  Sparkles,
  BarChart3,
  PieChartIcon,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Lightbulb,
  Activity
} from "lucide-react";

interface AIInsight {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  action: string;
}

interface Metrics {
  stageDistribution: Record<string, number>;
  statusDistribution: Record<string, number>;
  totalLeads: number;
  qualifiedLeads: number;
  totalOpportunities: number;
  closedOpportunities: number;
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--success))',
  'hsl(142.1, 76.2%, 36.3%)',
  'hsl(47.9, 95.8%, 53.1%)',
  'hsl(204.4, 100%, 69.2%)',
  'hsl(0, 84.2%, 60.2%)',
];

const STATUS_COLORS: Record<string, string> = {
  novo: '#3b82f6',
  em_contato: '#f59e0b',
  qualificado: '#10b981',
  proposta: '#8b5cf6',
  convertido: '#22c55e',
  perdido: '#ef4444',
};

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

  // New state for Charts and AI
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [weeklyFocus, setWeeklyFocus] = useState<string>('');

  useEffect(() => {
    if (user) {
      loadDashboardData();
      loadAIInsights();
      loadRecommendations();
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

      // Calcular distribuições para gráficos
      const statusDistribution: Record<string, number> = {
        novo: 0,
        em_contato: 0,
        qualificado: 0,
        proposta: 0,
        convertido: 0,
        perdido: 0,
      };

      leadsData.forEach(lead => {
        if (statusDistribution[lead.status] !== undefined) {
          statusDistribution[lead.status]++;
        }
      });

      const stageDistribution: Record<string, number> = {
        prospeccao: 0,
        qualificacao: 0,
        proposta: 0,
        negociacao: 0,
        fechamento: 0,
      };

      opportunitiesData?.forEach(opp => {
        if (stageDistribution[opp.estagio] !== undefined) {
          stageDistribution[opp.estagio]++;
        }
      });

      setMetrics({
        stageDistribution,
        statusDistribution,
        totalLeads: leadsData.length,
        qualifiedLeads: statusDistribution.qualificado,
        totalOpportunities: totalOportunidades,
        closedOpportunities: fechamentos
      });

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

  const loadAIInsights = async () => {
    if (!user) return;

    try {
      setLoadingInsights(true);

      const { data, error } = await supabase.functions.invoke('crm-ai-insights', {
        body: { userId: user.id, action: 'insights' }
      });

      if (error) throw error;

      if (data?.success && data?.data) {
        setInsights(data.data.insights || []);
        setSummary(data.data.summary || '');
      }
    } catch (error) {
      console.error('Erro ao carregar insights:', error);
      toast.error('Erro ao gerar insights com IA');
    } finally {
      setLoadingInsights(false);
    }
  };

  const loadRecommendations = async () => {
    if (!user) return;

    try {
      setLoadingInsights(true);

      const { data, error } = await supabase.functions.invoke('crm-ai-insights', {
        body: { userId: user.id, action: 'recommendations' }
      });

      if (error) throw error;

      if (data?.success && data?.data) {
        setRecommendations(data.data.recommendations || []);
        setWeeklyFocus(data.data.weekly_focus || '');
      }
    } catch (error) {
      console.error('Erro ao carregar recomendações:', error);
      // toast.error('Erro ao gerar recomendações com IA'); // Avoid double toast
    } finally {
      setLoadingInsights(false);
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'medium': return <Zap className="h-4 w-4 text-amber-500" />;
      case 'low': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      default: return <Lightbulb className="h-4 w-4 text-blue-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-red-500 bg-red-50 dark:bg-red-950/20';
      case 'medium': return 'border-l-amber-500 bg-amber-50 dark:bg-amber-950/20';
      case 'low': return 'border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/20';
      default: return 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20';
    }
  };

  // Prepare chart data
  const statusChartData = metrics ? Object.entries(metrics.statusDistribution).map(([name, value]) => ({
    name: name.replace('_', ' ').replace(/^\w/, c => c.toUpperCase()),
    value,
    fill: STATUS_COLORS[name] || CHART_COLORS[0],
  })) : [];

  const funnelData = metrics ? [
    { stage: 'Leads', value: metrics.totalLeads, fill: '#3b82f6' },
    { stage: 'Qualificados', value: metrics.qualifiedLeads, fill: '#f59e0b' },
    { stage: 'Oportunidades', value: metrics.totalOpportunities, fill: '#8b5cf6' },
    { stage: 'Fechados', value: metrics.closedOpportunities, fill: '#22c55e' },
  ] : [];

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
      <div className="grid grid-cols-1 gap-6">
        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Funnel Chart */}
          <Card className="shadow-soft">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Funil de Conversão</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={funnelData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="stage" type="category" width={100} className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Status Distribution Pie */}
          <Card className="shadow-soft">
            <CardHeader>
              <div className="flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Distribuição por Status</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {statusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* AI Insights Section */}
        <Card className="shadow-soft">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Insights com IA (Gemini 2.5 Flash)</CardTitle>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadAIInsights}
                  disabled={loadingInsights}
                >
                  <RefreshCw className={cn("h-4 w-4 mr-2", loadingInsights && "animate-spin")} />
                  Gerar Insights
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadRecommendations}
                  disabled={loadingInsights}
                >
                  <Lightbulb className="h-4 w-4 mr-2" />
                  Recomendações
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {insights.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insights.map((insight, index) => (
                  <div
                    key={index}
                    className={cn(
                      "border-l-4 rounded-lg p-4 space-y-2",
                      getPriorityColor(insight.priority)
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {getPriorityIcon(insight.priority)}
                      <h4 className="font-medium text-sm">{insight.title}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">{insight.description}</p>
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <ArrowRight className="h-3 w-3" />
                      <span>{insight.action}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Brain className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Clique em "Gerar Insights" para obter análises com IA</p>
              </div>
            )}

            {/* Weekly Focus & Recommendations */}
            {recommendations.length > 0 && (
              <div className="mt-6">
                <h4 className="font-medium mb-4 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  Recomendações da Semana
                </h4>
                {weeklyFocus && (
                  <div className="bg-primary/5 rounded-lg p-3 mb-4">
                    <p className="text-sm font-medium text-primary">🎯 Foco: {weeklyFocus}</p>
                  </div>
                )}
                <div className="space-y-3">
                  {recommendations.map((rec, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                    >
                      <Badge variant="outline" className="shrink-0">{rec.priority || index + 1}</Badge>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{rec.action}</p>
                        <p className="text-xs text-muted-foreground mt-1">{rec.reason}</p>
                        {rec.expected_impact && (
                          <p className="text-xs text-emerald-600 mt-1">
                            📈 {rec.expected_impact}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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