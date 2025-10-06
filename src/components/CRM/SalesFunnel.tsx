import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Filter,
  Users,
  Target,
  Clock,
  TrendingUp,
  Plus,
  Search,
  ArrowRight,
  Send,
  MapPin
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface FunnelStats {
  leads: number;
  contatados: number;
  qualificados: number;
  reunioes: number;
  propostas: number;
  fechamentos: number;
  perdidos: number;
}

interface SalesFunnelProps {
  onStatsUpdate: () => void;
}

const SalesFunnel = ({ onStatsUpdate }: SalesFunnelProps) => {
  const { user } = useAuth();
  const [stats, setStats] = useState<FunnelStats>({
    leads: 0,
    contatados: 0,
    qualificados: 0,
    reunioes: 0,
    propostas: 0,
    fechamentos: 0,
    perdidos: 0
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadFunnelStats();
    }
  }, [user]);

  const loadFunnelStats = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      console.log('📊 SalesFunnel: Carregando estatísticas com paginação...');

      // Carregar TODOS os leads com paginação
      let allLeads: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('leads')
          .select('status')
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
      
      const leadsData = allLeads;
      console.log(`✅ SalesFunnel: ${leadsData.length} leads carregados`);

      // Carregar estatísticas de oportunidades
      const { data: opportunitiesData, error: opportunitiesError } = await supabase
        .from('opportunities')
        .select('estagio')
        .eq('user_id', user.id);

      if (opportunitiesError) throw opportunitiesError;

      // Calcular estatísticas
      const newStats: FunnelStats = {
        leads: leadsData?.filter(l => l.status === 'novo').length || 0,
        contatados: leadsData?.filter(l => l.status === 'contatado').length || 0,
        qualificados: leadsData?.filter(l => l.status === 'qualificado').length || 0,
        reunioes: opportunitiesData?.filter(o => o.estagio === 'reuniao').length || 0,
        propostas: opportunitiesData?.filter(o => o.estagio === 'proposta').length || 0,
        fechamentos: opportunitiesData?.filter(o => o.estagio === 'fechamento').length || 0,
        perdidos: [...(leadsData?.filter(l => l.status === 'perdido') || []), ...(opportunitiesData?.filter(o => o.estagio === 'perdido') || [])].length
      };

      setStats(newStats);
      
      const totalCalculado = newStats.leads + newStats.contatados + newStats.qualificados + newStats.reunioes + newStats.propostas + newStats.fechamentos;
      console.log(`✅ SalesFunnel Stats calculados:`, {
        leads: newStats.leads,
        contatados: newStats.contatados,
        qualificados: newStats.qualificados,
        reunioes: newStats.reunioes,
        propostas: newStats.propostas,
        fechamentos: newStats.fechamentos,
        perdidos: newStats.perdidos,
        TOTAL: totalCalculado
      });
    } catch (error) {
      console.error('Erro ao carregar estatísticas do funil:', error);
      toast.error('Erro ao carregar estatísticas do funil');
    } finally {
      setLoading(false);
    }
  };

  const createAutoLeadCampaign = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    console.log('🔵 createAutoLeadCampaign called');
    if (!user) return;

    try {
      setLoading(true);
      
      // Usar fluxo completo automatizado de 4 fases
      const { data, error } = await supabase.functions.invoke('automated-campaign-flow', {
        body: { userId: user.id }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.message);
        loadFunnelStats();
        onStatsUpdate();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Erro ao criar campanha completa:', error);
      toast.error('Erro ao criar campanha automatizada');
    } finally {
      setLoading(false);
    }
  };

  const collectFromGoogleMaps = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    if (!user) return;

    // Solicitar parâmetros do usuário
    const searchQuery = prompt('Digite o termo de busca (ex: restaurante, advogado, clínica):');
    if (!searchQuery) return;

    const location = prompt('Digite a localização (ex: Goiânia, GO):', 'Goiânia, GO');
    if (!location) return;

    const maxResults = prompt('Quantos leads deseja coletar? (máximo 50):', '20');
    if (!maxResults) return;

    try {
      setLoading(true);
      
      // Usar apenas coleta do Google Maps
      const { data, error } = await supabase.functions.invoke('google-maps-scraper', {
        body: { 
          searchQuery,
          location,
          userId: user.id,
          maxResults: Math.min(parseInt(maxResults) || 20, 50)
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.message);
        loadFunnelStats();
        onStatsUpdate();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Erro ao coletar do Google Maps:', error);
      toast.error('Erro ao coletar leads do Google Maps');
    } finally {
      setLoading(false);
    }
  };

  const qualifyLeadsAutomatically = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    console.log('🟡 qualifyLeadsAutomatically called');
    if (!user) return;

    try {
      setLoading(true);

      console.log('🚀 Iniciando motor de qualificação completo...');
      
      // Chamar o motor de qualificação otimizado
      const { data, error } = await supabase.functions.invoke('qualification-engine', {
        body: { 
          criteria: {
            requiredUfs: ['SP', 'RJ', 'SC', 'PR', 'MG', 'GO'],
            excludedSituacoes: ['BAIXADA', 'SUSPENSA', 'INAPTA'],
            minCapitalSocial: 10000
          },
          batchSize: 10,
          userId: user.id
        }
      });

      if (error) {
        console.error('Erro ao qualificar:', error);
        throw error;
      }

      console.log('✅ Qualificação concluída:', data);

      if (data.processed > 0) {
        toast.success(
          `${data.qualified} leads qualificados de ${data.processed} processados!\n` +
          `✅ WhatsApp validado\n` +
          `🌐 Websites analisados\n` +
          `🏢 Dados enriquecidos`
        );
      } else {
        toast.info('Nenhum lead novo encontrado para processar.');
      }

      loadFunnelStats();
      onStatsUpdate();
    } catch (error) {
      console.error('Erro na qualificação automática:', error);
      toast.error('Erro ao executar qualificação de leads');
    } finally {
      setLoading(false);
    }
  };

  const total = stats.leads + stats.contatados + stats.qualificados + stats.reunioes + stats.propostas + stats.fechamentos;
  const conversionRate = total > 0 ? ((stats.fechamentos / total) * 100).toFixed(1) : '0';

  const funnelSteps = [
    { name: 'Leads', count: stats.leads, color: 'bg-blue-500', percentage: total > 0 ? (stats.leads / total) * 100 : 0 },
    { name: 'Contatados', count: stats.contatados, color: 'bg-yellow-500', percentage: total > 0 ? (stats.contatados / total) * 100 : 0 },
    { name: 'Qualificados', count: stats.qualificados, color: 'bg-orange-500', percentage: total > 0 ? (stats.qualificados / total) * 100 : 0 },
    { name: 'Reuniões', count: stats.reunioes, color: 'bg-purple-500', percentage: total > 0 ? (stats.reunioes / total) * 100 : 0 },
    { name: 'Propostas', count: stats.propostas, color: 'bg-pink-500', percentage: total > 0 ? (stats.propostas / total) * 100 : 0 },
    { name: 'Fechados', count: stats.fechamentos, color: 'bg-green-500', percentage: total > 0 ? (stats.fechamentos / total) * 100 : 0 }
  ];

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            Funil de Vendas
          </CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={(e) => qualifyLeadsAutomatically(e)}
              disabled={loading}
              type="button"
            >
              <Target className="h-4 w-4 mr-2" />
              Qualificar Leads
            </Button>
            <Button 
              onClick={(e) => createAutoLeadCampaign(e)}
              disabled={loading}
              type="button"
            >
              <Plus className="h-4 w-4 mr-2" />
              Criar Campanha Completa
            </Button>
            <Button 
              onClick={(e) => collectFromGoogleMaps(e)}
              disabled={loading}
              variant="outline"
              type="button"
            >
              <MapPin className="h-4 w-4 mr-2" />
              Coletar Google Maps
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-6">
          {/* Métricas principais */}
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gradient-subtle rounded-lg">
              <div className="text-2xl font-bold text-primary">{total}</div>
              <div className="text-sm text-muted-foreground">Total Prospects</div>
            </div>
            <div className="text-center p-4 bg-gradient-subtle rounded-lg">
              <div className="text-2xl font-bold text-success">{stats.fechamentos}</div>
              <div className="text-sm text-muted-foreground">Fechados</div>
            </div>
            <div className="text-center p-4 bg-gradient-subtle rounded-lg">
              <div className="text-2xl font-bold text-warning">{conversionRate}%</div>
              <div className="text-sm text-muted-foreground">Taxa Conversão</div>
            </div>
            <div className="text-center p-4 bg-gradient-subtle rounded-lg">
              <div className="text-2xl font-bold text-destructive">{stats.perdidos}</div>
              <div className="text-sm text-muted-foreground">Perdidos</div>
            </div>
          </div>

          {/* Funil visual */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Pipeline Atual</h3>
            <div className="space-y-3">
              {funnelSteps.map((step, index) => (
                <div key={step.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full ${step.color}`}></div>
                      <span className="font-medium">{step.name}</span>
                      <Badge variant="outline">{step.count}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {step.percentage.toFixed(1)}%
                    </div>
                  </div>
                  <Progress 
                    value={step.percentage} 
                    className="h-2"
                  />
                  {index < funnelSteps.length - 1 && (
                    <div className="flex justify-center">
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Ações rápidas */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Automações Disponíveis</h4>
              <div className="text-xs text-muted-foreground">
                • Qualificação automática por regime tributário<br />
                • Importação da base de conhecimento<br />
                • Follow-up programado por estágio
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Próximas Ações</h4>
              <div className="text-xs text-muted-foreground">
                • {stats.leads} leads aguardando contato<br />
                • {stats.contatados} prospects para qualificar<br />
                • {stats.qualificados} prontos para reunião
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SalesFunnel;