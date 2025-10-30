import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Smartphone, Plus, Trash2, QrCode, MessageSquare, Phone, RefreshCw, Activity, Users, BarChart3 } from 'lucide-react';
import EvolutionInstanceForm from './EvolutionInstanceForm';
import EvolutionMessages from './EvolutionMessages';
import WebhookLogs from './WebhookLogs';

interface EvolutionInstance {
  id: string;
  instance_name: string;
  phone_number: string | null;
  status: string;
  qr_code: string | null;
  is_active: boolean;
  created_at: string;
}

const EvolutionDashboard = () => {
  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadInstances();
    
    // Realtime updates
    const channel = supabase
      .channel('evolution_instances_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'evolution_instances'
        },
        () => {
          loadInstances();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadInstances = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('evolution_instances')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInstances(data || []);
    } catch (error) {
      console.error('Error loading instances:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar instâncias',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (instanceId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('evolution-manage-instance', {
        body: {
          action: 'connect',
          instanceId
        }
      });

      if (error) throw error;

      toast({
        title: 'Conectando',
        description: 'Escaneie o QR Code para conectar'
      });
      
      await loadInstances();
    } catch (error) {
      console.error('Error connecting:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao conectar instância',
        variant: 'destructive'
      });
    }
  };

  const handleDisconnect = async (instanceId: string) => {
    try {
      const { error } = await supabase.functions.invoke('evolution-manage-instance', {
        body: {
          action: 'disconnect',
          instanceId
        }
      });

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Instância desconectada'
      });
      
      await loadInstances();
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao desconectar instância',
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (instanceId: string) => {
    if (!confirm('Tem certeza que deseja deletar esta instância?')) return;

    try {
      const { error } = await supabase.functions.invoke('evolution-manage-instance', {
        body: {
          action: 'delete',
          instanceId
        }
      });

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Instância deletada'
      });
      
      await loadInstances();
    } catch (error) {
      console.error('Error deleting:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao deletar instância',
        variant: 'destructive'
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "destructive" | "outline" | "secondary"> = {
      connected: 'default',
      qr_code: 'secondary',
      connecting: 'secondary',
      disconnected: 'destructive'
    };

    const labels = {
      connected: 'Conectado',
      qr_code: 'QR Code',
      connecting: 'Conectando',
      disconnected: 'Desconectado'
    };

    return (
      <Badge variant={variants[status] || 'secondary'}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  if (loading) {
    return <div className="p-8">Carregando...</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Evolution API WhatsApp</h1>
          <p className="text-muted-foreground">Gerencie múltiplas instâncias WhatsApp</p>
        </div>
        <Button onClick={() => setShowAddForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Instância
        </Button>
      </div>

      {showAddForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Adicionar Nova Instância</CardTitle>
            <CardDescription>
              Configure uma nova instância da Evolution API
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EvolutionInstanceForm
              onSuccess={() => {
                setShowAddForm(false);
                loadInstances();
              }}
              onCancel={() => setShowAddForm(false)}
            />
          </CardContent>
        </Card>
      )}

      {instances.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Smartphone className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">Nenhuma instância configurada</h3>
            <p className="text-muted-foreground mb-4">
              Adicione sua primeira instância Evolution API para começar
            </p>
            <Button onClick={() => setShowAddForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Instância
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="instances" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="instances">
              <Smartphone className="w-4 h-4 mr-2" />
              Instâncias ({instances.length})
            </TabsTrigger>
            <TabsTrigger value="messages">
              <MessageSquare className="w-4 h-4 mr-2" />
              Mensagens
            </TabsTrigger>
            <TabsTrigger value="stats">
              <BarChart3 className="w-4 h-4 mr-2" />
              Estatísticas
            </TabsTrigger>
            <TabsTrigger value="logs">
              <Activity className="w-4 h-4 mr-2" />
              Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="instances" className="space-y-4">
            {instances.map((instance) => (
              <Card key={instance.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Smartphone className="w-5 h-5" />
                        {instance.instance_name}
                      </CardTitle>
                      <CardDescription>
                        {instance.phone_number || 'Aguardando conexão'}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(instance.status)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {instance.status === 'qr_code' && instance.qr_code && (
                      <div className="bg-white p-4 rounded-lg inline-block">
                        <img 
                          src={instance.qr_code} 
                          alt="QR Code" 
                          className="w-64 h-64"
                        />
                        <p className="text-center text-sm text-muted-foreground mt-2">
                          Escaneie com WhatsApp
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {instance.status === 'disconnected' && (
                        <Button onClick={() => handleConnect(instance.id)}>
                          <QrCode className="w-4 h-4 mr-2" />
                          Conectar
                        </Button>
                      )}
                      
                      {instance.status === 'connected' && (
                        <>
                          <Button 
                            variant="outline"
                            onClick={() => setSelectedInstance(instance.id)}
                          >
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Mensagens
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => handleDisconnect(instance.id)}
                          >
                            Desconectar
                          </Button>
                        </>
                      )}

                      {instance.status === 'qr_code' && (
                        <Button 
                          variant="outline"
                          onClick={() => handleConnect(instance.id)}
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Atualizar QR
                        </Button>
                      )}

                      <Button 
                        variant="destructive"
                        onClick={() => handleDelete(instance.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Deletar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="messages">
            {selectedInstance ? (
              <EvolutionMessages instanceId={selectedInstance} />
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Selecione uma instância para ver as mensagens
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="stats" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Instâncias</CardTitle>
                  <Phone className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{instances.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {instances.filter(i => i.status === 'connected').length} conectadas
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Mensagens Hoje</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">--</div>
                  <p className="text-xs text-muted-foreground">
                    Em desenvolvimento
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Taxa de Resposta</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">--</div>
                  <p className="text-xs text-muted-foreground">
                    Em desenvolvimento
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Leads Gerados</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">--</div>
                  <p className="text-xs text-muted-foreground">
                    Via mensagens WhatsApp
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Visão Geral das Instâncias</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {instances.map((instance) => (
                    <div key={instance.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{instance.instance_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {instance.phone_number || 'Aguardando conexão'}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        {getStatusBadge(instance.status)}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedInstance(instance.id)}
                        >
                          Ver Mensagens
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <WebhookLogs />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default EvolutionDashboard;
