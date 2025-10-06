import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Target, 
  Play,
  Pause,
  Edit,
  Trash2,
  Send
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const CampaignManager = () => {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (user) {
      loadCampaigns();
    }
  }, [user]);

  // Auto-reload separado para campanhas em execução
  useEffect(() => {
    if (!user || campaigns.length === 0) return;
    
    const hasRunning = campaigns.some(c => c.status === 'em_execucao');
    
    if (hasRunning) {
      const interval = setInterval(() => {
        loadCampaigns();
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [user, campaigns.length, campaigns.some(c => c.status === 'em_execucao')]);

  const loadCampaigns = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error('Erro ao carregar campanhas:', error);
      toast.error("Erro ao carregar campanhas");
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestMessage = async () => {
    if (!user) return;

    let toastId: string | number | undefined;
    
    try {
      toastId = toast.loading("Enviando mensagem de teste...");
      console.log('Iniciando envio de teste para 5562981647087');
      
      const { data, error } = await supabase.functions.invoke('whatsapp-service', {
        body: { 
          action: 'sendTest',
          userId: user.id,
          phoneNumber: '5562981647087'
        }
      });

      console.log('Resposta whatsapp-service:', { data, error });

      if (toastId) toast.dismiss(toastId);

      if (error) {
        console.error('Erro na função:', error);
        toast.error(`Erro ao enviar: ${error.message || 'Erro desconhecido'}`);
        return;
      }

      if (data?.success) {
        toast.success(`✅ Mensagem enviada para 5562981647087! Verifique os logs para detalhes.`);
      } else {
        toast.error(`Erro: ${data?.error || 'Falha ao enviar mensagem'}`);
      }
    } catch (error: any) {
      console.error('Erro ao enviar teste:', error);
      if (toastId) toast.dismiss(toastId);
      toast.error(`Erro: ${error.message || 'Falha ao enviar mensagem de teste'}`);
    }
  };

  const handleCreateCampaign = async () => {
    setIsCreating(true);
    try {
      console.log('Iniciando fluxo de campanha automatizada (4 fases) com user ID:', user?.id);
      
      const { data, error } = await supabase.functions.invoke('automated-campaign-flow', {
        body: { userId: user?.id }
      });

      console.log('Automated campaign flow response:', { data, error });

      if (error) {
        console.error('Supabase function invoke error:', error);
        throw new Error(error.message || 'Erro na chamada da função');
      }

      if (!data) {
        throw new Error('Nenhuma resposta recebida da função');
      }

      if (data.success) {
        toast.success(data.message);
        await loadCampaigns(); // Recarregar campanhas após criar nova
        
        // Mostrar detalhes da campanha criada
        if (data.campaignId) {
          toast.success("✅ Campanha executada com sucesso! Verifique os resultados na aba Resultados das Campanhas.");
        }
      } else {
        // Mostrar detalhes específicos dos erros
        const errorMessage = data.error || data.message || 'Erro desconhecido';
        
        // Se tiver detalhes das fases, mostrar informação mais específica
        if (data.phases) {
          const failedPhases = data.phases.filter((phase: any) => phase.status === 'failed');
          if (failedPhases.length > 0) {
            const phaseErrors = failedPhases.map((phase: any) => 
              `${phase.name}: ${phase.details?.error || 'Erro desconhecido'}`
            ).join('\n');
            console.error('Detalhes dos erros por fase:', phaseErrors);
            toast.error(`Falhas na execução:\n${phaseErrors}`);
          } else {
            toast.error(errorMessage);
          }
        } else {
          toast.error(errorMessage);
        }
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Erro ao criar campanha automatizada:', error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao criar campanha";
      toast.error(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const handleLaunchCampaign = async () => {
    setIsCreating(true);
    try {
      console.log('Lançando campanha com leads existentes qualificados para user ID:', user?.id);
      
      const { data, error } = await supabase.functions.invoke('launch-campaign', {
        body: { userId: user?.id }
      });

      console.log('Launch campaign response:', { data, error });

      if (error) {
        console.error('Supabase function invoke error:', error);
        throw new Error(error.message || 'Erro na chamada da função');
      }

      if (!data) {
        throw new Error('Nenhuma resposta recebida da função');
      }

      if (data.success) {
        toast.success(data.message);
        await loadCampaigns();
        
        if (data.campaignId) {
          toast.success("✅ Campanha lançada com sucesso para leads qualificados!");
        }
      } else {
        throw new Error(data.error || 'Erro desconhecido');
      }
    } catch (error) {
      console.error('Erro ao lançar campanha:', error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao lançar campanha";
      toast.error(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDispararPendentes = async () => {
    if (!user) return;
    
    setIsCreating(true);
    try {
      console.log('🚨 DISPARO URGENTE: Enviando para próximos 1000 leads pendentes');
      
      // Primeiro, criar uma nova campanha
      const { data: createData, error: createError } = await supabase.functions.invoke('campaign-service', {
        body: {
          action: 'create',
          userId: user.id,
          campaignData: {
            userId: user.id,
            name: `🚨 Disparo Urgente - ${new Date().toLocaleDateString('pt-BR')}`,
            description: 'Disparo emergencial para leads pendentes',
            status: 'ativa'
          }
        }
      });

      if (createError) throw createError;
      if (!createData?.success) throw new Error(createData?.error || 'Erro ao criar campanha');

      const campaignId = createData.data.id;
      console.log('Campanha criada:', campaignId);

      // Agora executar a campanha (que buscará apenas leads pendentes)
      const { data: runData, error: runError } = await supabase.functions.invoke('campaign-service', {
        body: {
          action: 'run',
          userId: user.id,
          campaignId: campaignId
        }
      });

      console.log('Run campaign response:', { runData, runError });

      if (runError) throw runError;
      if (!runData?.success) throw new Error(runData?.error || 'Erro ao executar campanha');

      toast.success(
        `🚀 ${runData.data.message}\n` +
        `📊 Total no banco: ${runData.data.totalInDatabase}\n` +
        `✅ Já enviados: ${runData.data.alreadySent}\n` +
        `⏳ Pendentes: ${runData.data.totalPending}\n` +
        `🎯 Processando agora: ${runData.data.totalLeads}`
      );

      await loadCampaigns();
    } catch (error) {
      console.error('Erro ao disparar para pendentes:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao disparar campanha urgente');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Gerenciar Campanhas
          </CardTitle>
      <div className="flex gap-2">
        <Button 
          onClick={handleSendTestMessage} 
          disabled={isCreating || loading}
          variant="secondary"
          size="sm"
        >
          <Send className="h-4 w-4 mr-2" />
          Teste WhatsApp
        </Button>
        <Button 
          onClick={handleDispararPendentes} 
          disabled={isCreating || loading}
          className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold"
        >
          <Send className="h-4 w-4 mr-2" />
          🚨 DISPARAR PENDENTES AGORA
        </Button>
        <Button onClick={handleCreateCampaign} disabled={isCreating || loading}>
          <Plus className="h-4 w-4 mr-2" />
          {isCreating ? 'Iniciando...' : 'Campanha Completa'}
        </Button>
        <Button 
          onClick={handleLaunchCampaign} 
          disabled={isCreating || loading}
          variant="outline"
        >
          <Send className="h-4 w-4 mr-2" />
          Lançar p/ Qualificados
        </Button>
      </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Carregando campanhas...</p>
          </div>
        ) : campaigns.length > 0 ? (
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold">{campaign.name}</h4>
                    <p className="text-sm text-muted-foreground">{campaign.description}</p>
                    
                    {/* Mostrar progresso se estiver em execução */}
                    {campaign.status === 'em_execucao' && campaign.description?.includes('Processando:') && (
                      <div className="mt-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                          <span className="animate-pulse">🔄</span>
                          <span>Em andamento...</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full transition-all duration-500"
                            style={{ 
                              width: `${campaign.description.match(/\((\d+)%\)/)?.[1] || 0}%` 
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <Badge variant={
                    campaign.status === 'ativa' ? 'default' :
                    campaign.status === 'em_execucao' ? 'secondary' :
                    campaign.status === 'concluida' ? 'outline' :
                    'destructive'
                  }>
                    {campaign.status === 'em_execucao' ? '🔄 Processando' : campaign.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Target className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhuma campanha encontrada</p>
            <p className="text-sm text-muted-foreground">
              Comece criando sua primeira campanha
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CampaignManager;