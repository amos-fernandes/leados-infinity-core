import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
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
  LineChart,
  Line,
  Area,
  AreaChart,
  Legend,
} from "recharts";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Target,
  Users,
  DollarSign,
  Zap,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Sparkles,
  BarChart3,
  PieChartIcon,
  Activity,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AIInsight {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  action: string;
}

interface Metrics {
  totalLeads: number;
  qualifiedLeads: number;
  newLeads: number;
  contactedLeads: number;
  totalOpportunities: number;
  pipelineValue: number;
  conversionRate: number;
  closedOpportunities: number;
  stageDistribution: Record<string, number>;
  statusDistribution: Record<string, number>;
}

interface BIDashboardProps {
  onStatsUpdate?: () => void;
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

const STAGE_COLORS: Record<string, string> = {
  prospeccao: '#3b82f6',
  qualificacao: '#f59e0b',
  proposta: '#8b5cf6',
  negociacao: '#06b6d4',
  fechamento: '#22c55e',
};

export const BIDashboard = ({ onStatsUpdate }: BIDashboardProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [weeklyFocus, setWeeklyFocus] = useState<string>('');

  const loadMetrics = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch leads
      const { data: leads } = await supabase
        .from('leads')
        .select('status, qualification_level, created_at')
        .eq('user_id', user.id);

      // Fetch opportunities
      const { data: opportunities } = await supabase
        .from('opportunities')
        .select('valor, estagio, created_at')
        .eq('user_id', user.id);

      const leadsData = leads || [];
      const oppsData = opportunities || [];

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

      oppsData.forEach(opp => {
        if (stageDistribution[opp.estagio] !== undefined) {
          stageDistribution[opp.estagio]++;
        }
      });

      const totalLeads = leadsData.length;
      const qualifiedLeads = statusDistribution.qualificado;
      const newLeads = statusDistribution.novo;
      const contactedLeads = statusDistribution.em_contato;
      const totalOpportunities = oppsData.length;
      const pipelineValue = oppsData.reduce((sum, o) => sum + (o.valor || 0), 0);
      const closedOpportunities = stageDistribution.fechamento;
      const conversionRate = totalLeads > 0 ? (closedOpportunities / totalLeads) * 100 : 0;

      setMetrics({
        totalLeads,
        qualifiedLeads,
        newLeads,
        contactedLeads,
        totalOpportunities,
        pipelineValue,
        conversionRate,
        closedOpportunities,
        stageDistribution,
        statusDistribution,
      });
    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
    } finally {
      setLoading(false);
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

        // Update metrics from AI response if available
        if (data.metrics) {
          setMetrics(prev => ({ ...prev, ...data.metrics }));
        }
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
      toast.error('Erro ao gerar recomendações com IA');
    } finally {
      setLoadingInsights(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, [user]);

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

  const stageChartData = metrics ? Object.entries(metrics.stageDistribution).map(([name, value]) => ({
    name: name.replace(/^\w/, c => c.toUpperCase()),
    value,
    fill: STAGE_COLORS[name] || CHART_COLORS[0],
  })) : [];

  const funnelData = metrics ? [
    { stage: 'Leads', value: metrics.totalLeads, fill: '#3b82f6' },
    { stage: 'Qualificados', value: metrics.qualifiedLeads, fill: '#f59e0b' },
    { stage: 'Oportunidades', value: metrics.totalOpportunities, fill: '#8b5cf6' },
    { stage: 'Fechados', value: metrics.closedOpportunities, fill: '#22c55e' },
  ] : [];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="shadow-soft">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Leads</p>
                <p className="text-2xl font-bold text-primary">{metrics?.totalLeads || 0}</p>
              </div>
              <Target className="h-8 w-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Qualificados</p>
                <p className="text-2xl font-bold text-emerald-600">{metrics?.qualifiedLeads || 0}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-emerald-500/20" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Oportunidades</p>
                <p className="text-2xl font-bold text-purple-600">{metrics?.totalOpportunities || 0}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500/20" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Fechados</p>
                <p className="text-2xl font-bold text-green-600">{metrics?.closedOpportunities || 0}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500/20" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Conversão</p>
                <p className="text-2xl font-bold text-blue-600">{metrics?.conversionRate?.toFixed(1) || 0}%</p>
              </div>
              <Activity className="h-8 w-8 text-blue-500/20" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pipeline</p>
                <p className="text-lg font-bold text-amber-600">
                  R$ {(metrics?.pipelineValue || 0).toLocaleString('pt-BR')}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-amber-500/20" />
            </div>
          </CardContent>
        </Card>
      </div>

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
          {summary && (
            <CardDescription className="mt-2 text-sm">
              {summary}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {loadingInsights ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : insights.length > 0 ? (
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
  );
};

export default BIDashboard;
