import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, CheckCircle, Clock, AlertCircle, Settings, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface MonitorLog {
  id: string;
  message: string;
  action: string;
  status: string;
  created_at: string;
}

export default function MonitorConsultivoPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<MonitorLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [n8nBaseUrl, setN8nBaseUrl] = useState("https://seu-dominio.hostinger.com.br");
  const [n8nWebhookPath, setN8nWebhookPath] = useState("/webhook/monitor-consultivo");
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    loadLogs();
    
    // Realtime subscription
    const channel = supabase
      .channel('monitor-logs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'interactions',
          filter: `user_id=eq.${user?.id}`
        },
        () => loadLogs()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadLogs = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("interactions")
        .select("*")
        .eq("user_id", user.id)
        .eq("tipo", "monitor")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      
      setLogs(data?.map(d => ({
        id: d.id,
        message: d.descricao || "",
        action: d.assunto,
        status: "concluído",
        created_at: d.created_at
      })) || []);
    } catch (error) {
      console.error("Erro ao carregar logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "concluído":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "em_andamento":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "erro":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    
    try {
      const fullUrl = `${n8nBaseUrl}${n8nWebhookPath}`;
      const response = await fetch(fullUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          test: true,
          user_id: user?.id,
          message: "Teste de conexão - Monitor Consultivo"
        })
      });

      if (response.ok) {
        toast.success("Conexão com n8n estabelecida com sucesso!");
      } else {
        toast.error(`Erro na conexão: ${response.status} ${response.statusText}`);
      }
    } catch (error: any) {
      console.error("Erro ao testar conexão:", error);
      toast.error("Erro ao testar conexão com n8n");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Monitor Consultivo</h1>
          <p className="text-muted-foreground">
            Recebe e processa mensagens de retorno dos fluxos n8n
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
                Configure a URL do seu n8n hospedado na Hostinger para receber notificações
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
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="webhook-path">Caminho do Webhook</Label>
                <Input
                  id="webhook-path"
                  placeholder="/webhook/monitor-consultivo"
                  value={n8nWebhookPath}
                  onChange={(e) => setN8nWebhookPath(e.target.value)}
                />
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-2">URL Completa:</p>
                <code className="text-xs bg-muted p-2 rounded block">
                  {n8nBaseUrl}{n8nWebhookPath}
                </code>
              </div>

              <Button
                onClick={handleTestConnection}
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
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Log de Atividades
              </CardTitle>
              <CardDescription>
                Acompanhe em tempo real as ações executadas pelo sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <Activity className="h-8 w-8 animate-pulse mx-auto" />
                  <p className="text-sm text-muted-foreground mt-2">Carregando logs...</p>
                </div>
              ) : logs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma atividade registrada ainda
                </p>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <Card key={log.id} className="border-l-4 border-l-primary">
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                          {getStatusIcon(log.status)}
                          <div className="flex-1">
                            <p className="font-semibold">{log.action}</p>
                            <p className="text-sm text-muted-foreground">{log.message}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {new Date(log.created_at).toLocaleString("pt-BR")}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fluxo Automático</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 list-decimal list-inside">
                <li>Recebe mensagem de retorno do n8n (<code>/webhook/monitor-consultivo</code>)</li>
                <li>Identifica "1 (Abrir conta)" na mensagem</li>
                <li>Cria registro na tabela Oportunidades com deadline de 15 dias</li>
                <li>Insere lead na reserva Salesforce</li>
                <li>Envia mensagem educativa com passo a passo</li>
                <li>Agenda lembretes automáticos antes do prazo</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
