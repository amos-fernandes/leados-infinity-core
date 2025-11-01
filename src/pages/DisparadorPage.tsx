import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Megaphone, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface CampaignHistory {
  id: string;
  campaign_name: string;
  created_at: string;
  status: string;
  leads_sent: number;
}

export default function DisparadorPage() {
  const { user } = useAuth();
  const [isSending, setIsSending] = useState(false);
  const [history, setHistory] = useState<CampaignHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [user]);

  const loadHistory = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, created_at, status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      
      setHistory(data?.map(d => ({
        id: d.id,
        campaign_name: d.name,
        created_at: d.created_at,
        status: d.status || "concluída",
        leads_sent: 0
      })) || []);
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDispararCampanha = async () => {
    setIsSending(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("n8n-webhook", {
        body: { 
          action: "disparar_campanha",
          webhook: "/webhook/disparar-campanha",
          user_id: user?.id
        }
      });

      if (error) throw error;

      toast.success("Campanha disparada com sucesso!");
      loadHistory();
    } catch (error: any) {
      console.error("Erro ao disparar campanha:", error);
      toast.error("Erro ao disparar campanha");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Disparador de Campanhas</h1>
          <p className="text-muted-foreground">
            Dispare campanhas automatizadas via n8n e WhatsApp API
          </p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5" />
                Nova Campanha
              </CardTitle>
              <CardDescription>
                Dispara fluxo automatizado para envio massivo de mensagens
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleDispararCampanha}
                disabled={isSending}
                size="lg"
                className="w-full"
              >
                {isSending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Disparando...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Disparar Campanha
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Histórico de Disparos</CardTitle>
              <CardDescription>Últimas campanhas enviadas</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                </div>
              ) : history.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma campanha disparada ainda
                </p>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => (
                    <Card key={item.id}>
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold">{item.campaign_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(item.created_at).toLocaleString("pt-BR")}
                            </p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded ${
                            item.status === "ativa" ? "bg-green-500/20 text-green-500" :
                            item.status === "erro" ? "bg-red-500/20 text-red-500" :
                            "bg-blue-500/20 text-blue-500"
                          }`}>
                            {item.status}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
