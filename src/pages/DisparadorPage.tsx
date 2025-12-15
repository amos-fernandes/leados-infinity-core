import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Megaphone, Loader2, Send, Settings, CheckCircle } from "lucide-react";
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
  const [n8nBaseUrl, setN8nBaseUrl] = useState("https://n8n-n8n.hrrtqk.easypanel.host");
  const [n8nWebhookPath, setN8nWebhookPath] = useState("/webhook/disparar-campanha-infinity");
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

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

  const handleTestarConexao = async () => {
    setIsTesting(true);

    try {
      const fullUrl = `${n8nBaseUrl}${n8nWebhookPath}`;
      const { data, error } = await supabase.functions.invoke('n8n-proxy', {
        body: {
          url: fullUrl,
          method: 'POST',
          body: {
            test: true,
            user_id: user?.id,
            message: "Teste de conexão Leados Infinity"
          }
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Conexão com n8n estabelecida com sucesso!");
      } else {
        toast.error(`Erro na conexão: ${data?.status || 'Erro desconhecido'}`);
      }
    } catch (error: any) {
      console.error("Erro ao testar conexão:", error);
      toast.error("Erro ao testar conexão com n8n");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSyncToN8n = async () => {
    if (!user) {
      toast.error("Você precisa estar logado");
      return;
    }

    setIsSyncing(true);

    try {
      const { data, error } = await supabase.functions.invoke('sync-to-n8n-postgres', {
        body: {
          tables: ['leads', 'opportunities', 'interactions', 'campaigns', 'contacts'],
          userId: user.id
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Dados sincronizados com sucesso para o PostgreSQL do n8n!");
        console.log("Resultados da sincronização:", data.results);
      } else {
        toast.error("Erro na sincronização");
      }
    } catch (error: any) {
      console.error("Erro ao sincronizar:", error);
      toast.error(`Erro ao sincronizar: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDispararCampanha = async () => {
    setIsSending(true);

    try {
      const fullUrl = `${n8nBaseUrl}${n8nWebhookPath}`;
      const { data, error } = await supabase.functions.invoke('n8n-proxy', {
        body: {
          url: fullUrl,
          method: 'POST',
          body: {
            action: "disparar_campanha",
            user_id: user?.id,
            timestamp: new Date().toISOString()
          }
        }
      });

      if (error) throw error;

      if (!data?.success) throw new Error(`HTTP error! status: ${data?.status}`);

      // Replicar dados automaticamente para PostgreSQL do n8n após disparar
      const syncResponse = await supabase.functions.invoke('sync-to-n8n-postgres', {
        body: {
          tables: ['leads', 'opportunities', 'interactions', 'campaigns', 'contacts'],
          userId: user?.id
        }
      });

      if (syncResponse.error) {
        console.error("Erro na sincronização automática:", syncResponse.error);
        toast.warning("Campanha disparada, mas houve erro na sincronização de dados");
      } else {
        toast.success("Campanha disparada e dados sincronizados com sucesso!");
      }

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
                <Settings className="h-5 w-5" />
                Configuração n8n (Hostinger)
              </CardTitle>
              <CardDescription>
                Configure a URL base do seu n8n hospedado na Hostinger
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="n8n-url">URL Base n8n</Label>
                <Input
                  id="n8n-url"
                  placeholder="https://seu-dominio.hostinger.com.br"
                  value={n8nBaseUrl}
                  onChange={(e) => setN8nBaseUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  URL do seu servidor n8n na Hostinger
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook-path">Caminho do Webhook</Label>
                <Input
                  id="webhook-path"
                  placeholder="/webhook/disparar-campanha"
                  value={n8nWebhookPath}
                  onChange={(e) => setN8nWebhookPath(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Caminho do webhook configurado no n8n
                </p>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-2">URL Completa:</p>
                <code className="text-xs bg-muted p-2 rounded block">
                  {n8nBaseUrl}{n8nWebhookPath}
                </code>
              </div>

              <Button
                onClick={handleTestarConexao}
                disabled={isTesting}
                variant="outline"
                className="w-full"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Testar Conexão
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>🔄 Sincronização de Dados</CardTitle>
              <CardDescription>
                Replica dados do Supabase Cloud para o PostgreSQL do n8n
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-2">Tabelas sincronizadas:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Leads</li>
                  <li>Oportunidades</li>
                  <li>Interações</li>
                  <li>Campanhas</li>
                  <li>Contatos</li>
                </ul>
              </div>
              <Button
                onClick={handleSyncToN8n}
                disabled={isSyncing}
                variant="outline"
                className="w-full"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  "Sincronizar Dados com n8n"
                )}
              </Button>
            </CardContent>
          </Card>

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
                          <span className={`text-xs px-2 py-1 rounded ${item.status === "ativa" ? "bg-green-500/20 text-green-500" :
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
