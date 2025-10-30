import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { 
  Play, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Smartphone,
  Users,
  Send,
  Activity
} from 'lucide-react';

interface TestLog {
  timestamp: string;
  type: 'info' | 'success' | 'error';
  message: string;
}

const CampaignTestPanel = () => {
  const [instances, setInstances] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>('');
  const [message, setMessage] = useState('');
  const [logs, setLogs] = useState<TestLog[]>([]);
  const [testing, setTesting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setLogs(prev => [...prev, {
      timestamp: new Date().toLocaleTimeString(),
      type,
      message
    }]);
  };

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      addLog('🔍 Carregando dados...', 'info');

      // Carregar instâncias conectadas
      const { data: instancesData, error: instancesError } = await supabase
        .from('evolution_instances')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'connected')
        .eq('is_active', true);

      if (instancesError) throw instancesError;
      setInstances(instancesData || []);
      addLog(`✅ ${instancesData?.length || 0} instâncias conectadas encontradas`, 'success');

      // Carregar leads com WhatsApp
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', user.id)
        .not('whatsapp', 'is', null)
        .limit(10);

      if (leadsError) throw leadsError;
      setLeads(leadsData || []);
      addLog(`✅ ${leadsData?.length || 0} leads com WhatsApp no CRM`, 'success');

    } catch (error) {
      console.error('Error loading data:', error);
      addLog('❌ Erro ao carregar dados', 'error');
      toast({
        title: 'Erro',
        description: 'Erro ao carregar dados',
        variant: 'destructive'
      });
    }
  };

  const testDirectSend = async () => {
    if (!selectedInstance) {
      toast({
        title: 'Erro',
        description: 'Selecione uma instância',
        variant: 'destructive'
      });
      return;
    }

    if (leads.length === 0) {
      toast({
        title: 'Erro',
        description: 'Nenhum lead disponível',
        variant: 'destructive'
      });
      return;
    }

    if (!message.trim()) {
      toast({
        title: 'Erro',
        description: 'Digite uma mensagem',
        variant: 'destructive'
      });
      return;
    }

    setTesting(true);
    setLogs([]);
    addLog('🚀 TESTE DIRETO: Iniciando disparo via Evolution API', 'info');

    try {
      const testLead = leads[0];
      addLog(`📱 Enviando para: ${testLead.empresa} (${testLead.whatsapp})`, 'info');

      const { data, error } = await supabase.functions.invoke('evolution-send-message', {
        body: {
          instanceId: selectedInstance,
          number: testLead.whatsapp,
          text: message
        }
      });

      if (error) throw error;

      if (data.success) {
        addLog('✅ Mensagem enviada com sucesso!', 'success');
        addLog(`📊 Message ID: ${data.messageId}`, 'info');
        toast({
          title: 'Sucesso!',
          description: 'Mensagem enviada via Evolution API'
        });
      } else {
        throw new Error(data.error || 'Erro desconhecido');
      }

    } catch (error) {
      console.error('Test error:', error);
      addLog(`❌ Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 'error');
      toast({
        title: 'Erro',
        description: 'Falha no envio',
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };

  const testN8NFlow = async () => {
    if (!selectedInstance) {
      toast({
        title: 'Erro',
        description: 'Selecione uma instância',
        variant: 'destructive'
      });
      return;
    }

    if (leads.length === 0) {
      toast({
        title: 'Erro',
        description: 'Nenhum lead disponível',
        variant: 'destructive'
      });
      return;
    }

    if (!message.trim()) {
      toast({
        title: 'Erro',
        description: 'Digite uma mensagem',
        variant: 'destructive'
      });
      return;
    }

    setTesting(true);
    setLogs([]);
    addLog('🔗 TESTE N8N: Iniciando fluxo via webhook N8N', 'info');

    try {
      addLog(`📤 Enviando para ${leads.length} leads via N8N`, 'info');

      const { data, error } = await supabase.functions.invoke('n8n-webhook', {
        body: {
          action: 'send_campaign',
          data: {
            instanceId: selectedInstance,
            leads: leads,
            message: message
          }
        }
      });

      if (error) throw error;

      if (data.success) {
        addLog(`✅ Campanha executada! ${data.sent} mensagens enviadas`, 'success');
        toast({
          title: 'Sucesso!',
          description: `${data.sent} mensagens enviadas via N8N`
        });
      } else {
        throw new Error(data.error || 'Erro desconhecido');
      }

    } catch (error) {
      console.error('N8N test error:', error);
      addLog(`❌ Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 'error');
      toast({
        title: 'Erro',
        description: 'Falha no fluxo N8N',
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Activity className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>🧪 Painel de Testes - Campanha Evolution</CardTitle>
          <CardDescription>
            Teste a integração completa: Evolution API → N8N → CRM
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Instâncias</p>
                    <p className="text-2xl font-bold">{instances.length}</p>
                  </div>
                  <Smartphone className="h-8 w-8 text-blue-500" />
                </div>
                <Badge variant={instances.length > 0 ? "default" : "destructive"} className="mt-2">
                  {instances.length > 0 ? 'Conectadas' : 'Nenhuma'}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Leads CRM</p>
                    <p className="text-2xl font-bold">{leads.length}</p>
                  </div>
                  <Users className="h-8 w-8 text-green-500" />
                </div>
                <Badge variant={leads.length > 0 ? "default" : "secondary"} className="mt-2">
                  Com WhatsApp
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="text-2xl font-bold">
                      {instances.length > 0 && leads.length > 0 ? '✅' : '⚠️'}
                    </p>
                  </div>
                  <Activity className="h-8 w-8 text-purple-500" />
                </div>
                <Badge variant={instances.length > 0 && leads.length > 0 ? "default" : "secondary"} className="mt-2">
                  {instances.length > 0 && leads.length > 0 ? 'Pronto' : 'Incompleto'}
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* Configuração */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Instância Evolution</label>
              <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma instância" />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((instance) => (
                    <SelectItem key={instance.id} value={instance.id}>
                      {instance.instance_name} - {instance.phone_number || 'Sem número'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Mensagem de Teste</label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Digite a mensagem que será enviada..."
                rows={4}
              />
            </div>
          </div>

          {/* Botões de Teste */}
          <div className="flex gap-4">
            <Button
              onClick={testDirectSend}
              disabled={testing || !selectedInstance || leads.length === 0}
              className="flex-1"
            >
              {testing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Teste Direto (1 lead)
            </Button>

            <Button
              onClick={testN8NFlow}
              disabled={testing || !selectedInstance || leads.length === 0}
              variant="outline"
              className="flex-1"
            >
              {testing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Teste via N8N ({leads.length} leads)
            </Button>
          </div>

          {/* Logs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Logs de Execução</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64 w-full rounded-md border p-4">
                {logs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum teste executado ainda
                  </p>
                ) : (
                  <div className="space-y-2">
                    {logs.map((log, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm">
                        {getLogIcon(log.type)}
                        <span className="text-muted-foreground">[{log.timestamp}]</span>
                        <span>{log.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Detalhes dos Leads */}
          {leads.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Leads Disponíveis para Teste</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {leads.slice(0, 5).map((lead, index) => (
                    <div key={lead.id} className="flex items-center justify-between border-b pb-2">
                      <div>
                        <p className="font-medium">{lead.empresa}</p>
                        <p className="text-sm text-muted-foreground">{lead.whatsapp}</p>
                      </div>
                      <Badge variant="outline">{lead.status}</Badge>
                    </div>
                  ))}
                  {leads.length > 5 && (
                    <p className="text-sm text-muted-foreground text-center pt-2">
                      + {leads.length - 5} leads adicionais
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CampaignTestPanel;
