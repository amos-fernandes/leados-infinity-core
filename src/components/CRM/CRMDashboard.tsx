import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart3, 
  Users, 
  Target, 
  TrendingUp,
  Calendar,
  DollarSign,
  Plus,
  Download,
  Brain,
  Sparkles,
  CheckCircle2,
  Zap,
  LayoutDashboard,
  Kanban,
  List,
  MessageSquare
} from "lucide-react";
import LeadsManager from "./LeadsManager";
import ContactsManager from "./ContactsManager";
import OpportunitiesManager from "./OpportunitiesManager";
import InteractionsManager from "./InteractionsManager";
import KanbanBoard from "./KanbanBoard";
import BIDashboard from "./BIDashboard";
import CampaignManager from "../CampaignManager";
import CampaignResults from "../CampaignResults";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const CRMDashboard = () => {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isQualifying, setIsQualifying] = useState(false);
  const [viewMode, setViewMode] = useState<'dashboard' | 'kanban' | 'list'>('dashboard');
  const [stats, setStats] = useState({
    totalLeads: 0,
    totalContacts: 0,
    totalOpportunities: 0,
    totalInteractions: 0,
    qualifiedLeads: 0,
    hotLeads: 0,
    conversionRate: 0,
    pipelineValue: 0
  });

  const loadStats = async () => {
    if (!user) return;

    try {
      console.log('📊 CRMDashboard: Carregando estatísticas...');
      
      // Load leads with pagination
      let allLeads: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('leads')
          .select('status, qualification_level')
          .eq('user_id', user.id)
          .range(from, from + pageSize - 1);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          allLeads = [...allLeads, ...data];
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }
      
      const leads = allLeads;
      console.log(`✅ CRMDashboard: ${leads.length} leads carregados`);

      const { data: contacts } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', user.id);

      const { data: opportunities } = await supabase
        .from('opportunities')
        .select('valor, estagio')
        .eq('user_id', user.id);

      const { data: interactions } = await supabase
        .from('interactions')
        .select('id')
        .eq('user_id', user.id);

      const totalLeads = leads?.length || 0;
      const qualifiedLeads = leads?.filter(l => l.status === 'qualificado').length || 0;
      const hotLeads = leads?.filter(l => l.qualification_level === 'high').length || 0;
      const closedOpportunities = opportunities?.filter(o => o.estagio === 'fechamento').length || 0;
      const conversionRate = totalLeads > 0 ? (closedOpportunities / totalLeads) * 100 : 0;
      const pipelineValue = opportunities?.reduce((sum, opp) => sum + (opp.valor || 0), 0) || 0;

      setStats({
        totalLeads,
        totalContacts: contacts?.length || 0,
        totalOpportunities: opportunities?.length || 0,
        totalInteractions: interactions?.length || 0,
        qualifiedLeads,
        hotLeads,
        conversionRate: parseFloat(conversionRate.toFixed(1)),
        pipelineValue
      });
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const handleGenerateProspects = async () => {
    setIsGenerating(true);
    try {
      console.log('Iniciando fluxo de campanha automatizada:', user?.id);
      
      const { data, error } = await supabase.functions.invoke('automated-campaign-flow', {
        body: { userId: user?.id }
      });

      if (error) {
        console.error('Supabase function invoke error:', error);
        throw new Error(error.message || 'Erro na chamada da função');
      }

      if (!data) {
        throw new Error('Nenhuma resposta recebida da função');
      }

      if (data.success) {
        toast.success(data.message);
        await loadStats();
      } else {
        throw new Error(data.error || 'Erro desconhecido');
      }
    } catch (error) {
      console.error('Erro ao executar campanha automatizada:', error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleQualifyLeads = async () => {
    setIsQualifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('qualify-leads', {
        body: { userId: user?.id }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.message);
        await loadStats();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Erro ao qualificar leads:', error);
      toast.error(error instanceof Error ? error.message : "Erro ao qualificar leads");
    } finally {
      setIsQualifying(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [user]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">CRM Dashboard</h1>
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" />
              AI-Powered
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Business Intelligence com IA Gemini 2.5 Flash
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {/* View Mode Toggle */}
          <div className="flex rounded-lg border bg-muted p-1">
            <Button
              variant={viewMode === 'dashboard' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('dashboard')}
              className="gap-2"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Button>
            <Button
              variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('kanban')}
              className="gap-2"
            >
              <Kanban className="h-4 w-4" />
              Kanban
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="gap-2"
            >
              <List className="h-4 w-4" />
              Lista
            </Button>
          </div>

          <Button 
            onClick={handleGenerateProspects}
            disabled={isGenerating || isQualifying}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Brain className="h-4 w-4 mr-2" />
            {isGenerating ? 'Executando...' : 'Nova Campanha IA'}
          </Button>
          <Button 
            variant="outline"
            onClick={handleQualifyLeads}
            disabled={isQualifying || isGenerating}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {isQualifying ? 'Qualificando...' : 'Qualificar Todos'}
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-primary/5 rounded-lg p-3 flex items-center gap-3">
          <Target className="h-5 w-5 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Total Leads</p>
            <p className="text-lg font-bold">{stats.totalLeads}</p>
          </div>
        </div>
        <div className="bg-emerald-500/5 rounded-lg p-3 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          <div>
            <p className="text-xs text-muted-foreground">Qualificados</p>
            <p className="text-lg font-bold">{stats.qualifiedLeads}</p>
          </div>
        </div>
        <div className="bg-amber-500/5 rounded-lg p-3 flex items-center gap-3">
          <Zap className="h-5 w-5 text-amber-500" />
          <div>
            <p className="text-xs text-muted-foreground">Prioritários</p>
            <p className="text-lg font-bold">{stats.hotLeads}</p>
          </div>
        </div>
        <div className="bg-purple-500/5 rounded-lg p-3 flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-purple-500" />
          <div>
            <p className="text-xs text-muted-foreground">Oportunidades</p>
            <p className="text-lg font-bold">{stats.totalOpportunities}</p>
          </div>
        </div>
        <div className="bg-blue-500/5 rounded-lg p-3 flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-blue-500" />
          <div>
            <p className="text-xs text-muted-foreground">Conversão</p>
            <p className="text-lg font-bold">{stats.conversionRate}%</p>
          </div>
        </div>
        <div className="bg-green-500/5 rounded-lg p-3 flex items-center gap-3">
          <DollarSign className="h-5 w-5 text-green-500" />
          <div>
            <p className="text-xs text-muted-foreground">Pipeline</p>
            <p className="text-lg font-bold">R$ {(stats.pipelineValue / 1000).toFixed(0)}k</p>
          </div>
        </div>
      </div>

      {/* Main Content based on View Mode */}
      {viewMode === 'dashboard' && (
        <BIDashboard onStatsUpdate={loadStats} />
      )}

      {viewMode === 'kanban' && (
        <KanbanBoard onStatsUpdate={loadStats} />
      )}

      {viewMode === 'list' && (
        <Tabs defaultValue="leads" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="leads">
              <Target className="h-4 w-4 mr-2" />
              Leads
            </TabsTrigger>
            <TabsTrigger value="contacts">
              <Users className="h-4 w-4 mr-2" />
              Contatos
            </TabsTrigger>
            <TabsTrigger value="opportunities">
              <TrendingUp className="h-4 w-4 mr-2" />
              Oportunidades
            </TabsTrigger>
            <TabsTrigger value="interactions">
              <MessageSquare className="h-4 w-4 mr-2" />
              Interações
            </TabsTrigger>
            <TabsTrigger value="campaigns">
              <Brain className="h-4 w-4 mr-2" />
              Campanhas
            </TabsTrigger>
            <TabsTrigger value="results">
              <BarChart3 className="h-4 w-4 mr-2" />
              Resultados
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="leads">
            <LeadsManager onStatsUpdate={loadStats} />
          </TabsContent>
          
          <TabsContent value="contacts">
            <ContactsManager onStatsUpdate={loadStats} />
          </TabsContent>
          
          <TabsContent value="opportunities">
            <OpportunitiesManager onStatsUpdate={loadStats} />
          </TabsContent>
          
          <TabsContent value="interactions">
            <InteractionsManager onStatsUpdate={loadStats} />
          </TabsContent>

          <TabsContent value="campaigns">
            <CampaignManager />
          </TabsContent>
          
          <TabsContent value="results">
            <CampaignResults />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default CRMDashboard;
