import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
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

interface CampaignConfig {
  minDelay: number;
  maxDelay: number;
  batchSize: number;
  rotateInstances: boolean;
}

const CampaignTestPanel = () => {
  const [instances, setInstances] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>('');
  const [message, setMessage] = useState('');
  const [logs, setLogs] = useState<TestLog[]>([]);
  const [testing, setTesting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [config, setConfig] = useState<CampaignConfig>({
    minDelay: 3,
    maxDelay: 8,
    batchSize: 50,
    rotateInstances: true
  });
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
      if (!user) {
        addLog('❌ Usuário não autenticado', 'error');
        return;
      }

      addLog('🔍 Carregando dados...', 'info');
      console.log('👤 User ID:', user.id);

      // Carregar TODAS as instâncias
      const { data: instancesData, error: instancesError } = await supabase
        .from('evolution_instances')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      console.log('📱 Instâncias encontradas:', instancesData);

      if (instancesError) {
        addLog(`❌ Erro ao carregar instâncias: ${instancesError.message}`, 'error');
        console.error('❌ Erro instâncias:', instancesError);
      }
      
      setInstances(instancesData || []);
      
      const connectedCount = instancesData?.filter(i => i.status === 'connected').length || 0;
      addLog(`✅ ${instancesData?.length || 0} instâncias encontradas (${connectedCount} conectadas)`, 'success');

      // Buscar TODOS os leads com WhatsApp que ainda não receberam mensagem
      // Primeiro, pegar IDs de leads que já receberam mensagens
      const { data: sentMessages } = await supabase
        .from('evolution_messages')
        .select('lead_id')
        .eq('user_id', user.id)
        .not('lead_id', 'is', null);

      const sentLeadIds = sentMessages?.map(m => m.lead_id) || [];
      console.log('📤 Leads que já receberam mensagens:', sentLeadIds);

      // Carregar TODOS os leads com WhatsApp que NÃO receberam mensagem
      let query = supabase
        .from('leads')
        .select('*')
        .eq('user_id', user.id)
        .neq('whatsapp', '')
        .not('whatsapp', 'is', null);

      // Filtrar leads que já receberam mensagem
      if (sentLeadIds.length > 0) {
        query = query.not('id', 'in', `(${sentLeadIds.join(',')})`);
      }

      const { data: leadsData, error: leadsError } = await query;

      console.log('👥 Leads não enviados:', leadsData);

      if (leadsError) {
        addLog(`❌ Erro ao carregar leads: ${leadsError.message}`, 'error');
        console.error('❌ Erro leads:', leadsError);
      }
      
      setLeads(leadsData || []);
      addLog(`✅ ${leadsData?.length || 0} leads PENDENTES de envio`, leadsData?.length ? 'success' : 'info');

    } catch (error) {
      console.error('Error loading data:', error);
      addLog(`❌ Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 'error');
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
        description: 'Selecione uma instância Evolution conectada',
        variant: 'destructive'
      });
      addLog('⚠️ Nenhuma instância selecionada', 'error');
      return;
    }

    const instance = instances.find(i => i.id === selectedInstance);
    if (instance?.status !== 'connected') {
      toast({
        title: 'Erro',
        description: 'A instância selecionada não está conectada',
        variant: 'destructive'
      });
      addLog(`⚠️ Instância ${instance?.instance_name} está ${instance?.status}`, 'error');
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
      
      console.log('📤 Test payload:', {
        instanceId: selectedInstance,
        number: testLead.whatsapp,
        text: message
      });

      const { data, error } = await supabase.functions.invoke('evolution-send-message', {
        body: {
          instanceId: selectedInstance,
          number: testLead.whatsapp,
          text: message
        }
      });

      console.log('📥 Response:', { data, error });

      if (error) {
        console.error('❌ Function error:', error);
        throw error;
      }

      if (!data || !data.success) {
        const errorMsg = data?.error || 'Erro desconhecido';
        console.error('❌ API returned error:', errorMsg);
        addLog(`❌ Evolution API Error: ${errorMsg}`, 'error');
        throw new Error(errorMsg);
      }

      addLog('✅ Mensagem enviada com sucesso!', 'success');
      addLog(`📊 Message ID: ${data.messageId}`, 'info');
      addLog(`📊 Evolution Data: ${JSON.stringify(data.data)}`, 'info');
      toast({
        title: 'Sucesso!',
        description: 'Mensagem enviada via Evolution API'
      });

    } catch (error) {
      console.error('❌ Test error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      addLog(`❌ Erro detalhado: ${errorMsg}`, 'error');
      toast({
        title: 'Erro no envio',
        description: errorMsg,
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };

  const testN8NFlow = async () => {
    if (instances.length === 0) {
      toast({
        title: 'Erro',
        description: 'Nenhuma instância disponível',
        variant: 'destructive'
      });
      return;
    }

    // Filtrar apenas instâncias conectadas
    const connectedInstances = instances.filter(i => i.status === 'connected');
    
    if (connectedInstances.length === 0) {
      toast({
        title: 'Erro',
        description: 'Nenhuma instância conectada. Conecte pelo menos uma instância.',
        variant: 'destructive'
      });
      return;
    }

    if (leads.length === 0) {
      toast({
        title: 'Aviso',
        description: 'Todos os leads já receberam mensagem!',
        variant: 'default'
      });
      addLog('✅ Todos os leads já foram contactados', 'success');
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
    addLog('🚀 CAMPANHA INTELIGENTE: Iniciando disparo otimizado', 'info');
    addLog(`📊 Total de leads: ${leads.length}`, 'info');
    addLog(`📱 Instâncias ativas: ${connectedInstances.length}`, 'info');
    addLog(`⏱️ Delay entre envios: ${config.minDelay}-${config.maxDelay}s`, 'info');
    addLog(`📦 Tamanho do lote: ${config.batchSize}`, 'info');
    addLog(`🔄 Rotação de instâncias: ${config.rotateInstances ? 'SIM' : 'NÃO'}`, 'info');

    let successCount = 0;
    let errorCount = 0;
    let currentInstanceIndex = 0;

    const getRandomDelay = () => {
      return (Math.random() * (config.maxDelay - config.minDelay) + config.minDelay) * 1000;
    };

    const getNextInstance = () => {
      if (!config.rotateInstances) {
        return connectedInstances[0];
      }
      const instance = connectedInstances[currentInstanceIndex];
      currentInstanceIndex = (currentInstanceIndex + 1) % connectedInstances.length;
      return instance;
    };

    try {
      // Dividir em lotes
      const totalBatches = Math.ceil(leads.length / config.batchSize);
      
      for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
        const startIdx = batchNum * config.batchSize;
        const endIdx = Math.min(startIdx + config.batchSize, leads.length);
        const batch = leads.slice(startIdx, endIdx);
        
        addLog(`\n📦 Lote ${batchNum + 1}/${totalBatches} (${batch.length} leads)`, 'info');

        for (let i = 0; i < batch.length; i++) {
          const lead = batch[i];
          const globalProgress = startIdx + i + 1;
          const currentInstance = getNextInstance();
          
          addLog(
            `📱 [${globalProgress}/${leads.length}] ${lead.empresa} → Instância: ${currentInstance.instance_name}`,
            'info'
          );

          try {
            const { data, error } = await supabase.functions.invoke('evolution-send-message', {
              body: {
                instanceId: currentInstance.id,
                number: lead.whatsapp,
                text: message
              }
            });

            if (error) {
              const errorMsg = error.message || '';
              
              // Erros que removem a instância da rotação
              if (errorMsg.includes('404') || 
                  errorMsg.includes('não existe') || 
                  errorMsg.includes('não encontrada') ||
                  errorMsg.includes('inativa') ||
                  errorMsg.includes('400') || 
                  errorMsg.includes('undefined') ||
                  errorMsg.includes('não está conectada')) {
                
                addLog(`❌ Instância ${currentInstance.instance_name} falhou: ${errorMsg}`, 'error');
                
                // Remover da lista de rotação
                const index = connectedInstances.indexOf(currentInstance);
                if (index > -1) {
                  connectedInstances.splice(index, 1);
                  addLog(`🔄 Instância removida. ${connectedInstances.length} restantes`, 'info');
                }
                
                // Se não há mais instâncias, parar campanha
                if (connectedInstances.length === 0) {
                  addLog(`❌ Nenhuma instância válida. Parando campanha.`, 'error');
                  toast({
                    title: 'Campanha Interrompida',
                    description: 'Todas as instâncias falharam. Atualize e reconecte-as.',
                    variant: 'destructive'
                  });
                  
                  // Recarregar dados automaticamente
                  await loadData();
                  break;
                }
                continue;
              }
              
              throw error;
            }

            if (data && data.success) {
              successCount++;
              addLog(`✅ [${globalProgress}/${leads.length}] Enviado`, 'success');
            } else {
              throw new Error(data?.error || 'Erro desconhecido');
            }

            // Delay randômico antes do próximo envio
            if (globalProgress < leads.length) {
              const delay = getRandomDelay();
              addLog(`⏳ Aguardando ${(delay / 1000).toFixed(1)}s...`, 'info');
              await new Promise(resolve => setTimeout(resolve, delay));
            }

          } catch (sendError) {
            errorCount++;
            const errorMsg = sendError instanceof Error ? sendError.message : 'Erro desconhecido';
            addLog(`❌ [${globalProgress}/${leads.length}] Falha: ${errorMsg}`, 'error');
            
            if (errorCount >= 5 && successCount === 0) {
              addLog(`⚠️ Muitos erros consecutivos. Verifique as instâncias.`, 'error');
              break;
            }
          }
        }

        // Pausa entre lotes
        if (batchNum < totalBatches - 1) {
          addLog(`\n💤 Pausa entre lotes (5s)...`, 'info');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }

      addLog(`\n📊 RESUMO FINAL:`, 'info');
      addLog(`✅ Enviados com sucesso: ${successCount}`, 'success');
      if (errorCount > 0) {
        addLog(`❌ Falharam: ${errorCount}`, 'error');
      }
      addLog(`📈 Taxa de sucesso: ${((successCount / leads.length) * 100).toFixed(1)}%`, 'info');
      
      if (config.rotateInstances && connectedInstances.length > 1) {
        addLog(`🔄 Rotação usou ${connectedInstances.length} instâncias`, 'info');
      }

      toast({
        title: 'Campanha Concluída!',
        description: `${successCount} enviados, ${errorCount} falharam`,
        variant: successCount > 0 ? 'default' : 'destructive'
      });

      await loadData();

    } catch (error) {
      console.error('Campaign error:', error);
      addLog(`❌ Erro crítico: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 'error');
      toast({
        title: 'Erro na Campanha',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
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
          {/* Botão Recarregar */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={testing}
            >
              <Activity className="h-4 w-4 mr-2" />
              Atualizar Dados
            </Button>
          </div>
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
                  <SelectValue placeholder={instances.length > 0 ? "Selecione uma instância" : "Nenhuma instância disponível"} />
                </SelectTrigger>
                <SelectContent>
                  {instances.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Nenhuma instância Evolution encontrada.<br />
                      Configure uma instância no menu Evolution API.
                    </div>
                  ) : (
                    instances.map((instance) => (
                      <SelectItem key={instance.id} value={instance.id}>
                        {instance.instance_name} - {instance.phone_number || 'Sem número'} 
                        <Badge variant={instance.status === 'connected' ? 'default' : 'secondary'} className="ml-2">
                          {instance.status}
                        </Badge>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {instances.length === 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  💡 Acesse <strong>Evolution API</strong> no dashboard para configurar instâncias
                </p>
              )}
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

            {/* Configurações Avançadas */}
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">⚙️ Configurações Avançadas</label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  {showAdvanced ? 'Ocultar' : 'Mostrar'}
                </Button>
              </div>

              {showAdvanced && (
                <div className="space-y-4 pt-2 border-t">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">
                        Delay Mínimo (segundos)
                      </label>
                      <Input
                        type="number"
                        min="1"
                        max="30"
                        value={config.minDelay}
                        onChange={(e) => setConfig({...config, minDelay: Number(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">
                        Delay Máximo (segundos)
                      </label>
                      <Input
                        type="number"
                        min="1"
                        max="30"
                        value={config.maxDelay}
                        onChange={(e) => setConfig({...config, maxDelay: Number(e.target.value)})}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">
                      Tamanho do Lote
                    </label>
                    <Input
                      type="number"
                      min="10"
                      max="500"
                      step="10"
                      value={config.batchSize}
                      onChange={(e) => setConfig({...config, batchSize: Number(e.target.value)})}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Leads por lote com pausa de 5s entre lotes
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Rotação de Instâncias</label>
                      <p className="text-xs text-muted-foreground">
                        Alterna entre todas as instâncias conectadas
                      </p>
                    </div>
                    <Button
                      variant={config.rotateInstances ? "default" : "outline"}
                      size="sm"
                      onClick={() => setConfig({...config, rotateInstances: !config.rotateInstances})}
                    >
                      {config.rotateInstances ? '✅ Ativo' : '❌ Inativo'}
                    </Button>
                  </div>
                </div>
              )}
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
              disabled={testing || !selectedInstance}
              variant="default"
              className="flex-1"
              size="lg"
            >
              {testing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {leads.length === 0 
                ? '✅ Todos Enviados!' 
                : `🚀 Enviar TODOS (${leads.length} pendentes)`
              }
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
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {leads.length > 0 
                  ? `Leads Pendentes de Envio (${leads.length} total)` 
                  : '✅ Nenhum Lead Pendente - Todos Enviados!'
                }
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leads.length > 0 ? (
                <div className="space-y-2">
                  {leads.slice(0, 10).map((lead, index) => (
                    <div key={lead.id} className="flex items-center justify-between border-b pb-2">
                      <div>
                        <p className="font-medium">{lead.empresa}</p>
                        <p className="text-sm text-muted-foreground">{lead.whatsapp}</p>
                      </div>
                      <Badge variant="secondary">Pendente</Badge>
                    </div>
                  ))}
                  {leads.length > 10 && (
                    <p className="text-sm text-muted-foreground text-center pt-2 font-medium">
                      + {leads.length - 10} leads adicionais serão enviados
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    Todos os leads com WhatsApp já receberam mensagens via Evolution API
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
};

export default CampaignTestPanel;
