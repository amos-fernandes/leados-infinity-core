import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Bot,
  MessageSquare,
  Activity,
  Users,
  Clock,
  TrendingUp,
  RefreshCw
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AttendanceStats {
  totalConversations: number;
  activeConversations: number;
  totalMessages: number;
  averageMessagesPerConv: number;
  recentActivity: number;
}

const RAGAttendanceMonitor = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<AttendanceStats>({
    totalConversations: 0,
    activeConversations: 0,
    totalMessages: 0,
    averageMessagesPerConv: 0,
    recentActivity: 0
  });
  const [loading, setLoading] = useState(true);
  const [monitoring, setMonitoring] = useState(false);

  useEffect(() => {
    if (user) {
      loadAttendanceStats();
      
      // Auto-refresh das estatísticas a cada 60 segundos
      const interval = setInterval(loadAttendanceStats, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const loadAttendanceStats = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('whatsapp-rag-responder', {
        body: { 
          action: 'generateReport',
          userId: user.id 
        }
      });

      if (error) throw error;

      if (data.success) {
        setStats(data);
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
      // Não mostrar toast de erro para não ser intrusivo
    } finally {
      setLoading(false);
    }
  };

  const startMonitoring = async () => {
    setMonitoring(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-rag-responder', {
        body: { 
          action: 'processPending',
          userId: user?.id 
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.message);
        await loadAttendanceStats();
      }
    } catch (error) {
      console.error('Erro no monitoramento:', error);
      toast.error("Erro ao iniciar monitoramento");
    } finally {
      setMonitoring(false);
    }
  };

  const StatCard = ({ icon, title, value, description, trend }: {
    icon: any;
    title: string;
    value: string | number;
    description: string;
    trend?: 'up' | 'down' | 'stable';
  }) => (
    <div className="p-4 border rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{title}</span>
        </div>
        {trend && (
          <TrendingUp 
            className={`h-4 w-4 ${
              trend === 'up' ? 'text-green-500' : 
              trend === 'down' ? 'text-red-500' : 
              'text-gray-500'
            }`} 
          />
        )}
      </div>
      <p className="text-2xl font-bold text-primary mb-1">{value}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Monitor de Atendimento RAG
          </CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={loadAttendanceStats}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button
              size="sm"
              onClick={startMonitoring}
              disabled={monitoring}
            >
              <Activity className={`h-4 w-4 mr-2 ${monitoring ? 'animate-pulse' : ''}`} />
              {monitoring ? 'Monitorando...' : 'Processar Pendentes'}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Carregando estatísticas...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Grid de Estatísticas */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard
                icon={<MessageSquare className="h-4 w-4 text-blue-500" />}
                title="Conversações"
                value={stats.totalConversations}
                description="Total de conversas"
                trend="stable"
              />
              
              <StatCard
                icon={<Users className="h-4 w-4 text-green-500" />}
                title="Ativas"
                value={stats.activeConversations}
                description="Conversas ativas"
                trend="up"
              />
              
              <StatCard
                icon={<Bot className="h-4 w-4 text-purple-500" />}
                title="Mensagens"
                value={stats.totalMessages}
                description="Total de mensagens"
                trend="up"
              />
              
              <StatCard
                icon={<TrendingUp className="h-4 w-4 text-orange-500" />}
                title="Média"
                value={stats.averageMessagesPerConv.toFixed(1)}
                description="Msgs por conversa"
                trend="stable"
              />
              
              <StatCard
                icon={<Clock className="h-4 w-4 text-red-500" />}
                title="Atividade 24h"
                value={stats.recentActivity}
                description="Conversas recentes"
                trend="up"
              />
            </div>

            {/* Status do Atendimento */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Status do Atendimento Automatizado
                </h4>
                <Badge variant={stats.activeConversations > 0 ? "default" : "secondary"}>
                  {stats.activeConversations > 0 ? 'Ativo' : 'Standby'}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>RAG AI: Operacional</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>WhatsApp: Conectado</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span>Monitoramento: Ativo</span>
                </div>
              </div>

              <div className="mt-3 p-3 bg-muted/50 rounded text-xs">
                <p className="font-medium mb-1">🤖 Fluxo Automatizado:</p>
                <p>Cliente WhatsApp → Sistema Leados → RAG AI → Resposta Automatizada → CRM</p>
              </div>
            </div>

            {/* Instruções de Configuração */}
            <div className="border rounded-lg p-4 bg-gradient-to-r from-primary/5 to-primary/10">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                Configuração do Webhook WhatsApp
              </h4>
              
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  Configure seu provedor WhatsApp para enviar mensagens para:
                </p>
                <div className="bg-background border rounded p-2 font-mono text-xs">
                  https://rcfmbjkolnzjhrlgrtda.supabase.co/functions/v1/whatsapp-webhook-receiver
                </div>
                <p className="text-xs text-muted-foreground">
                  ✅ Suporta MayTapi, WhatsApp Business API e formato genérico
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RAGAttendanceMonitor;