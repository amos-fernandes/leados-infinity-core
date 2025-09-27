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
        throw new Error(data.error || 'Erro desconhecido');
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

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Gerenciar Campanhas
          </CardTitle>
          <div className="flex gap-2">
            <Button onClick={handleCreateCampaign} disabled={isCreating || loading}>
              <Plus className="h-4 w-4 mr-2" />
              {isCreating ? 'Criando...' : 'Campanha Completa (4 Fases)'}
            </Button>
            <Button 
              onClick={handleLaunchCampaign} 
              disabled={isCreating || loading}
              variant="outline"
            >
              <Send className="h-4 w-4 mr-2" />
              Lançar p/ Leads Qualificados
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
                  <div>
                    <h4 className="font-semibold">{campaign.name}</h4>
                    <p className="text-sm text-muted-foreground">{campaign.description}</p>
                  </div>
                  <Badge variant="outline">{campaign.status}</Badge>
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