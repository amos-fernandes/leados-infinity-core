import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ColetarLeadsPage() {
  const [isCollecting, setIsCollecting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; count: number; message: string } | null>(null);

  const handleCollectLeads = async () => {
    setIsCollecting(true);
    setResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke("n8n-webhook", {
        body: { 
          action: "collect_leads",
          webhook: "/webhook/coletar-leads"
        }
      });

      if (error) throw error;

      setResult({
        success: true,
        count: data?.leadsCollected || 0,
        message: data?.message || "Leads coletados com sucesso!"
      });
      
      toast.success(`${data?.leadsCollected || 0} leads coletados com sucesso!`);
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
