import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MessageSquare, 
  Mail, 
  Phone,
  Eye,
  Download,
  TrendingUp,
  Calendar,
  FileText
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { saveKnowledgeToFile } from "@/data/knowledgeBase";

interface CampaignResult {
  id: string;
  name: string;
  description: string;
  status: string;
  target_companies: string[];
  created_at: string;
  scripts: {
    id: string;
    empresa: string;
    roteiro_ligacao: string;
    modelo_email: string;
    assunto_email: string;
    whatsapp_sent: boolean;
    email_sent: boolean;
    call_made: boolean;
    status: string;
  }[];
}

const CampaignResults = () => {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<CampaignResult[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [knowledgeContent, setKnowledgeContent] = useState<string>('');

  const loadCampaignResults = async () => {
    if (!user) return;

    try {
      const { data: campaignsData, error } = await supabase
        .from('campaigns')
        .select(`
          *,
          campaign_scripts(*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedCampaigns: CampaignResult[] = campaignsData?.map(campaign => ({
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        status: campaign.status,
        target_companies: campaign.target_companies,
        created_at: campaign.created_at,
        scripts: campaign.campaign_scripts || []
      })) || [];

      setCampaigns(formattedCampaigns);
      if (formattedCampaigns.length > 0 && !selectedCampaign) {
        setSelectedCampaign(formattedCampaigns[0]);
      }
    } catch (error) {
      console.error('Erro ao carregar resultados das campanhas:', error);
      toast.error("Erro ao carregar resultados das campanhas");
    } finally {
      setLoading(false);
    }
  };

  const generateKnowledgeFile = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const content = await saveKnowledgeToFile(user.id);
      setKnowledgeContent(content);
      
      // Criar e baixar arquivo
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `knowledge-base-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Arquivo de conhecimento gerado e baixado!");
    } catch (error) {
      console.error('Erro ao gerar arquivo de conhecimento:', error);
      toast.error("Erro ao gerar arquivo de conhecimento");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaignResults();
  }, [user]);

  const getStatusBadge = (status: string) => {
    const variants = {
      'ativa': 'default',
      'pausada': 'secondary',
      'concluida': 'destructive',
      'pendente': 'outline'
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  const getProgressStats = (scripts: any[]) => {
    const total = scripts.length;
    const whatsappSent = scripts.filter(s => s.whatsapp_sent).length;
    const emailsSent = scripts.filter(s => s.email_sent).length;
    const callsMade = scripts.filter(s => s.call_made).length;
    
    return { total, whatsappSent, emailsSent, callsMade };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-primary">Carregando resultados das campanhas...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Resultados das Campanhas</h2>
          <p className="text-muted-foreground">
            Histórico completo de e-mails, WhatsApp e ganchos de prospecção
          </p>
        </div>
        <Button onClick={generateKnowledgeFile} disabled={loading}>
          <FileText className="h-4 w-4 mr-2" />
          Exportar Knowledge Base
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma campanha encontrada</h3>
            <p className="text-muted-foreground">
              Execute uma campanha primeiro para ver os resultados aqui
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Lista de Campanhas */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Campanhas Executadas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {campaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedCampaign?.id === campaign.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedCampaign(campaign)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm">{campaign.name}</h4>
                      {getStatusBadge(campaign.status)}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {campaign.scripts.length} roteiros
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(campaign.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Detalhes da Campanha */}
          <div className="lg:col-span-3">
            {selectedCampaign ? (
              <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                  <TabsTrigger value="emails">E-mails</TabsTrigger>
                  <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
                  <TabsTrigger value="scripts">Roteiros</TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Eye className="h-5 w-5" />
                        {selectedCampaign.name}
                      </CardTitle>
                      <p className="text-muted-foreground">
                        {selectedCampaign.description}
                      </p>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const stats = getProgressStats(selectedCampaign.scripts);
                        return (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center p-4 bg-gradient-subtle rounded-lg">
                              <div className="text-2xl font-bold text-primary">{stats.total}</div>
                              <div className="text-sm text-muted-foreground">Total Roteiros</div>
                            </div>
                            <div className="text-center p-4 bg-gradient-subtle rounded-lg">
                              <div className="text-2xl font-bold text-success">{stats.whatsappSent}</div>
                              <div className="text-sm text-muted-foreground">WhatsApp Enviados</div>
                            </div>
                            <div className="text-center p-4 bg-gradient-subtle rounded-lg">
                              <div className="text-2xl font-bold text-info">{stats.emailsSent}</div>
                              <div className="text-sm text-muted-foreground">E-mails Enviados</div>
                            </div>
                            <div className="text-center p-4 bg-gradient-subtle rounded-lg">
                              <div className="text-2xl font-bold text-warning">{stats.callsMade}</div>
                              <div className="text-sm text-muted-foreground">Ligações Feitas</div>
                            </div>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="emails">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        E-mails Enviados
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Empresa</TableHead>
                            <TableHead>Assunto</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Enviado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedCampaign.scripts
                            .filter(script => script.email_sent)
                            .map((script) => (
                              <TableRow key={script.id}>
                                <TableCell className="font-medium">{script.empresa}</TableCell>
                                <TableCell>{script.assunto_email}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-success/10 text-success">
                                    Enviado
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                </TableCell>
                              </TableRow>
                            ))
                          }
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="whatsapp">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        WhatsApp Enviados
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Empresa</TableHead>
                            <TableHead>Mensagem</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedCampaign.scripts
                            .filter(script => script.whatsapp_sent)
                            .map((script) => (
                              <TableRow key={script.id}>
                                <TableCell className="font-medium">{script.empresa}</TableCell>
                                <TableCell className="max-w-md truncate">
                                  {script.roteiro_ligacao.substring(0, 100)}...
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-success/10 text-success">
                                    Enviado
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))
                          }
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="scripts">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Phone className="h-5 w-5" />
                        Roteiros Completos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {selectedCampaign.scripts.map((script) => (
                          <div key={script.id} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="font-semibold text-lg">{script.empresa}</h4>
                              {getStatusBadge(script.status)}
                            </div>
                            
                            <div className="grid md:grid-cols-2 gap-4">
                              <div>
                                <h5 className="font-medium mb-2 text-primary">Roteiro de Ligação</h5>
                                <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                                  {script.roteiro_ligacao}
                                </p>
                              </div>
                              
                              <div>
                                <h5 className="font-medium mb-2 text-primary">Modelo de E-mail</h5>
                                <p className="text-sm font-medium mb-1">{script.assunto_email}</p>
                                <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                                  {script.modelo_email}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Selecione uma campanha</h3>
                  <p className="text-muted-foreground">
                    Clique em uma campanha à esquerda para ver os resultados detalhados
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignResults;