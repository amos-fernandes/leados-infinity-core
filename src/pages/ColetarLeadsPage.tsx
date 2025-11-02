import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, Loader2, CheckCircle, AlertCircle, Settings } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function ColetarLeadsPage() {
  const [isCollecting, setIsCollecting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; count: number; message: string } | null>(null);
  const [n8nBaseUrl, setN8nBaseUrl] = useState("https://neurocapital.cloud:5678");
  const [n8nWebhookPath, setN8nWebhookPath] = useState("/webhook/Lead_Machine_Legal");
  const [isTesting, setIsTesting] = useState(false);

  const handleTestConnection = async () => {
    setIsTesting(true);
    
    try {
      const fullUrl = `${n8nBaseUrl}${n8nWebhookPath}`;
      
      const { data, error } = await supabase.functions.invoke('n8n-proxy', {
        body: {
          url: fullUrl,
          method: "POST",
          body: { 
            test: true,
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

  const handleCollectLeads = async () => {
    setIsCollecting(true);
    setResult(null);
    
    try {
      const fullUrl = `${n8nBaseUrl}${n8nWebhookPath}`;
      
      const { data, error } = await supabase.functions.invoke('n8n-proxy', {
        body: {
          url: fullUrl,
          method: "POST",
          body: { 
            action: "collect_leads",
            timestamp: new Date().toISOString()
          }
        }
      });

      if (error) throw error;

      if (data?.success) {
        const responseData = data.data || {};
        setResult({
          success: true,
          count: responseData?.leadsCollected || 0,
          message: responseData?.message || "Leads coletados com sucesso!"
        });
        
        toast.success(`${responseData?.leadsCollected || 0} leads coletados com sucesso!`);
      } else {
        throw new Error(data?.error || 'Erro ao coletar leads');
      }
    } catch (error: any) {
      console.error("Erro ao coletar leads:", error);
      setResult({
        success: false,
        count: 0,
        message: error.message || "Erro ao coletar leads"
      });
      toast.error("Erro ao coletar leads");
    } finally {
      setIsCollecting(false);
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Coletar Leads</h1>
          <p className="text-muted-foreground">
            Dispare fluxos automatizados para buscar e validar leads de múltiplas fontes
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
                Configure a URL do seu n8n hospedado na Hostinger
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
                  placeholder="/webhook/coletar-leads"
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
                <TrendingUp className="h-5 w-5" />
                Fluxo de Coleta Automática
              </CardTitle>
              <CardDescription>
                Conecta-se ao n8n para buscar leads de planilhas, APIs e formulários externos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={handleCollectLeads}
                disabled={isCollecting}
                size="lg"
                className="w-full"
              >
                {isCollecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Coletando leads...
                  </>
                ) : (
                  <>
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Iniciar Coleta
                  </>
                )}
              </Button>

              {result && (
                <Card className={result.success ? "border-green-500" : "border-red-500"}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      {result.success ? (
                        <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                      )}
                      <div>
                        <p className="font-semibold">
                          {result.success ? "Coleta Concluída" : "Erro na Coleta"}
                        </p>
                        <p className="text-sm text-muted-foreground">{result.message}</p>
                        {result.success && result.count > 0 && (
                          <p className="text-2xl font-bold mt-2">{result.count} leads</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Como Funciona</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 list-decimal list-inside">
                <li>Dispara webhook para n8n em <code>/webhook/coletar-leads</code></li>
                <li>Busca leads de fontes configuradas (Google Sheets, APIs, Formulários)</li>
                <li>Valida duplicidade no banco de dados</li>
                <li>Insere automaticamente no CRM com status "Novo Lead"</li>
                <li>Retorna notificação com número de leads coletados</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
