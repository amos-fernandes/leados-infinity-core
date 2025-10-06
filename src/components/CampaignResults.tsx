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
  target_companies: any;
  created_at: string;
  scripts: {
    id?: string;
    empresa: string;
    roteiro_ligacao: string | null;
    modelo_email: string | null;
    assunto_email: string | null;
    whatsapp_enviado: boolean | null;
    email_enviado: boolean | null;
    ligacao_feita: boolean | null;
  }[];
}

const CampaignResults = () => {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<CampaignResult[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignResult | null>(null);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingScripts, setLoadingScripts] = useState(false);
  const [knowledgeContent, setKnowledgeContent] = useState<string>('');

  const loadCampaignResults = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Carregar apenas campanhas (sem scripts para evitar timeout)
      const { data: campaignsData, error } = await supabase
        .from('campaigns')
        .select('id, name, description, status, target_companies, created_at, user_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Carregar contagem de scripts por campanha
      const campaignsWithCount = await Promise.all(
        (campaignsData || []).map(async (campaign) => {
          const { count } = await supabase
            .from('campaign_scripts')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', campaign.id);
          
          return {
            id: campaign.id,
            name: campaign.name,
            description: campaign.description,
            status: campaign.status,
            target_companies: campaign.target_companies,
            created_at: campaign.created_at,
            scripts: [], // Scripts serão carregados on-demand
            scriptsCount: count || 0
          };
        })
      );

      setCampaigns(campaignsWithCount);
      
      // Selecionar primeira campanha e carregar seus scripts
      if (campaignsWithCount.length > 0 && !selectedCampaign) {
        await loadCampaignScripts(campaignsWithCount[0]);
      }
    } catch (error) {
      console.error('Erro ao carregar resultados das campanhas:', error);
      toast.error("Erro ao carregar campanhas");
    } finally {
      setLoading(false);
    }
  };

  const loadCampaignScripts = async (campaign: CampaignResult) => {
    if (!campaign) return;

    try {
      setLoadingScripts(true);
      
      // Carregar TODOS os scripts da campanha (sem limite para ter estatísticas corretas)
      const { data: scriptsData, error } = await supabase
        .from('campaign_scripts')
        .select('*')
        .eq('campaign_id', campaign.id);

      if (error) throw error;

      // Carregar interações relacionadas ao período da campanha
      const campaignDate = new Date(campaign.created_at);
      const dayAfter = new Date(campaignDate);
      dayAfter.setDate(dayAfter.getDate() + 1);

      const { data: interactionsData } = await supabase
        .from('interactions')
        .select('*')
        .eq('user_id', user!.id)
        .in('tipo', ['email', 'whatsapp', 'ligacao', 'follow_up'])
        .gte('created_at', campaignDate.toISOString())
        .lte('created_at', dayAfter.toISOString())
        .order('created_at', { ascending: false });

      setInteractions(interactionsData || []);

      const updatedCampaign = {
        ...campaign,
        scripts: scriptsData || []
      };

      setSelectedCampaign(updatedCampaign);
    } catch (error) {
      console.error('Erro ao carregar scripts da campanha:', error);
      toast.error("Erro ao carregar scripts");
    } finally {
      setLoadingScripts(false);
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
    if (user) {
      loadCampaignResults();
    }
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
    const whatsappSent = scripts.filter(s => s.whatsapp_enviado).length;
    const emailsSent = scripts.filter(s => s.email_enviado).length;
    const callsMade = scripts.filter(s => s.ligacao_feita).length;
    
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
                    onClick={() => loadCampaignScripts(campaign)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm line-clamp-1">{campaign.name}</h4>
                      {getStatusBadge(campaign.status)}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        📄 {(campaign as any).scriptsCount || 0} scripts criados
                      </p>
                      <p className="text-xs text-muted-foreground">
                        📅 {new Date(campaign.created_at).toLocaleDateString('pt-BR', { 
                          day: '2-digit', 
                          month: '2-digit', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Detalhes da Campanha */}
          <div className="lg:col-span-3">
            {loadingScripts ? (
              <Card>
                <CardContent className="text-center py-12">
                  <div className="text-primary animate-pulse">Carregando scripts da campanha...</div>
                </CardContent>
              </Card>
            ) : selectedCampaign ? (
              <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                  <TabsTrigger value="historico">Histórico Completo</TabsTrigger>
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
                          <div className="space-y-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="text-center p-4 bg-gradient-subtle rounded-lg border border-border">
                                <div className="text-3xl font-bold text-primary">{stats.total}</div>
                                <div className="text-sm text-muted-foreground mt-1">Scripts Gerados</div>
                              </div>
                              <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                                <div className="text-3xl font-bold text-green-600">{stats.whatsappSent}</div>
                                <div className="text-sm text-muted-foreground mt-1">WhatsApp Enviados</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {stats.total > 0 ? Math.round((stats.whatsappSent / stats.total) * 100) : 0}% do total
                                </div>
                              </div>
                              <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                <div className="text-3xl font-bold text-blue-600">{stats.emailsSent}</div>
                                <div className="text-sm text-muted-foreground mt-1">E-mails Enviados</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {stats.total > 0 ? Math.round((stats.emailsSent / stats.total) * 100) : 0}% do total
                                </div>
                              </div>
                              <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                <div className="text-3xl font-bold text-yellow-600">{stats.callsMade}</div>
                                <div className="text-sm text-muted-foreground mt-1">Ligações Feitas</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {stats.total > 0 ? Math.round((stats.callsMade / stats.total) * 100) : 0}% do total
                                </div>
                              </div>
                            </div>
                            
                            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                              <div className="flex items-start gap-3">
                                <TrendingUp className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                <div>
                                  <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">
                                    Status da Campanha
                                  </h4>
                                  <p className="text-sm text-amber-800 dark:text-amber-200">
                                    {stats.total} scripts foram criados. 
                                    {stats.whatsappSent > 0 && ` ${stats.whatsappSent} mensagens WhatsApp enviadas`}
                                    {stats.emailsSent > 0 && `, ${stats.emailsSent} e-mails enviados`}
                                    {stats.callsMade > 0 && `, ${stats.callsMade} ligações feitas`}.
                                    {(stats.whatsappSent + stats.emailsSent + stats.callsMade) === 0 && 
                                      ' Nenhum disparo foi executado ainda.'}
                                  </p>
                                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">
                                    Total de interações registradas: {interactions.length}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="historico">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Histórico Completo de Interações
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data/Hora</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Empresa</TableHead>
                            <TableHead>Descrição</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {interactions
                            .filter(interaction => {
                              // Filtrar interações relacionadas à campanha selecionada
                              const campaignDate = new Date(selectedCampaign.created_at);
                              const interactionDate = new Date(interaction.created_at);
                              const diffHours = Math.abs(interactionDate.getTime() - campaignDate.getTime()) / 36e5;
                              return diffHours <= 24; // Interações do mesmo dia da campanha
                            })
                            .map((interaction, index) => (
                              <TableRow key={interaction.id || index}>
                                <TableCell>
                                  {new Date(interaction.created_at).toLocaleString('pt-BR')}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={
                                    interaction.tipo === 'whatsapp' ? 'bg-green-100 text-green-700' :
                                    interaction.tipo === 'email' ? 'bg-blue-100 text-blue-700' :
                                    interaction.tipo === 'ligacao' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-gray-100 text-gray-700'
                                  }>
                                    {interaction.tipo.toUpperCase()}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-medium">
                                  {interaction.assunto.split(' - ')[1] || interaction.assunto}
                                </TableCell>
                                <TableCell className="max-w-lg">
                                  <details className="cursor-pointer">
                                    <summary className="text-sm text-muted-foreground">
                                      {interaction.descricao.substring(0, 100)}...
                                    </summary>
                                    <div className="mt-2 p-3 bg-muted/50 rounded text-sm whitespace-pre-wrap">
                                      {interaction.descricao}
                                    </div>
                                  </details>
                                </TableCell>
                              </TableRow>
                            ))
                          }
                        </TableBody>
                      </Table>
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
                            .filter(script => script.email_enviado)
                            .map((script, index) => (
                              <TableRow key={script.id || index}>
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
                            .filter(script => script.whatsapp_enviado)
                            .map((script, index) => (
                              <TableRow key={script.id || index}>
                                <TableCell className="font-medium">{script.empresa}</TableCell>
                                <TableCell className="max-w-md truncate">
                                  {script.roteiro_ligacao?.substring(0, 100) || 'Sem roteiro'}...
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
                        Roteiros Utilizados nos Leads Qualificados
                      </CardTitle>
                      <p className="text-muted-foreground">
                        Todos os roteiros personalizados criados para esta campanha
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {selectedCampaign.scripts.map((script, index) => (
                          <div key={script.id || index} className="border rounded-lg p-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-lg">{script.empresa}</h4>
                              <div className="flex gap-2">
                                {script.whatsapp_enviado && <Badge className="bg-green-100 text-green-700">WhatsApp ✓</Badge>}
                                {script.email_enviado && <Badge className="bg-blue-100 text-blue-700">E-mail ✓</Badge>}
                                {script.ligacao_feita && <Badge className="bg-yellow-100 text-yellow-700">Ligação ✓</Badge>}
                              </div>
                            </div>
                            
                            <Tabs defaultValue="email" className="w-full">
                              <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="email">E-mail</TabsTrigger>
                                <TabsTrigger value="ligacao">Ligação</TabsTrigger>
                                <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
                              </TabsList>
                              
                              <TabsContent value="email" className="space-y-3">
                                <div>
                                  <h5 className="font-medium text-sm text-muted-foreground">Assunto:</h5>
                                  <p className="text-sm bg-muted/50 p-2 rounded">{script.assunto_email}</p>
                                </div>
                                <div>
                                  <h5 className="font-medium text-sm text-muted-foreground">Conteúdo:</h5>
                                  <div className="text-sm bg-muted/50 p-3 rounded whitespace-pre-wrap max-h-40 overflow-y-auto">
                                    {script.modelo_email || 'Modelo de e-mail não disponível'}
                                  </div>
                                </div>
                              </TabsContent>
                              
                              <TabsContent value="ligacao" className="space-y-3">
                                <div>
                                  <h5 className="font-medium text-sm text-muted-foreground">Roteiro de Ligação:</h5>
                                  <div className="text-sm bg-muted/50 p-3 rounded whitespace-pre-wrap max-h-40 overflow-y-auto">
                                    {script.roteiro_ligacao || 'Roteiro de ligação não disponível'}
                                  </div>
                                </div>
                              </TabsContent>
                              
                              <TabsContent value="whatsapp" className="space-y-3">
                                <div>
                                  <h5 className="font-medium text-sm text-muted-foreground">Mensagem WhatsApp:</h5>
                                  <div className="text-sm bg-muted/50 p-3 rounded whitespace-pre-wrap max-h-40 overflow-y-auto">
                                    {interactions
                                      .filter(i => i.tipo === 'whatsapp' && i.assunto.includes(script.empresa))
                                      .map(i => i.descricao.split('Mensagem enviada:\n\n')[1]?.split('\n\nTelefone:')[0])
                                      .find(msg => msg) || 'Mensagem WhatsApp baseada no template padrão C6 Bank'}
                                  </div>
                                </div>
                              </TabsContent>
                            </Tabs>
                          </div>
                        ))}
                        
                        {selectedCampaign.scripts.length === 0 && (
                          <div className="text-center py-8">
                            <Phone className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                            <p className="text-muted-foreground">Nenhum roteiro encontrado para esta campanha</p>
                          </div>
                        )}
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
                    Escolha uma campanha da lista para ver seus resultados detalhados
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