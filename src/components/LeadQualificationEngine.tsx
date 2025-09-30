import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Play, Settings, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface QualificationCriteria {
  requiredCnaes?: string[];
  requiredUfs?: string[];
  minCapitalSocial?: number;
  maxCapitalSocial?: number;
  requiredRegimeTributario?: string[];
  excludedSituacoes?: string[];
}

interface QualificationResult {
  processed: number;
  qualified: number;
  unqualified: number;
  errors: number;
  details: Array<{
    leadId: string;
    empresa: string;
    status: string;
    score: number;
    qualified: boolean;
  }>;
}

const LeadQualificationEngine: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [results, setResults] = useState<QualificationResult | null>(null);
  const [criteria, setCriteria] = useState<QualificationCriteria>({
    requiredUfs: ['SP', 'RJ', 'SC', 'PR', 'MG'],
    excludedSituacoes: ['BAIXADA', 'SUSPENSA', 'INAPTA'],
    minCapitalSocial: 10000,
    requiredCnaes: []
  });

  const handleRunQualification = async () => {
    setIsRunning(true);
    setResults(null);

    try {
      console.log('🚀 Iniciando processo de qualificação...');
      
      const { data, error } = await supabase.functions.invoke('qualification-engine', {
        body: { 
          criteria,
          batchSize: 10
        }
      });

      if (error) {
        throw error;
      }

      setResults(data);
      
      if (data.processed > 0) {
        toast.success(`Qualificação concluída! ${data.qualified} leads qualificados de ${data.processed} processados.`);
      } else {
        toast.info('Nenhum lead novo encontrado para processar.');
      }
      
    } catch (error) {
      console.error('Erro na qualificação:', error);
      toast.error('Erro ao executar qualificação de leads');
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'QUALIFIED':
        return 'bg-green-500';
      case 'UNQUALIFIED':
        return 'bg-red-500';
      case 'PROCESSING':
        return 'bg-yellow-500';
      case 'ERROR':
        return 'bg-gray-500';
      default:
        return 'bg-blue-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'QUALIFIED':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'UNQUALIFIED':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'ERROR':
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
      default:
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Motor de Qualificação de Leads
              </CardTitle>
              <CardDescription>
                Pipeline automatizado para enriquecer e qualificar leads baseado em critérios de negócio
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings className="h-4 w-4 mr-2" />
                Configurar
              </Button>
              <Button
                onClick={handleRunQualification}
                disabled={isRunning}
                className="bg-primary hover:bg-primary/90"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Executar Qualificação
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        {showSettings && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Critérios de UF */}
              <div className="space-y-2">
                <Label htmlFor="ufs">Estados Aceitos (UFs)</Label>
                <Input
                  id="ufs"
                  placeholder="SP, RJ, SC, PR, MG"
                  value={criteria.requiredUfs?.join(', ') || ''}
                  onChange={(e) => setCriteria(prev => ({
                    ...prev,
                    requiredUfs: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  }))}
                />
              </div>

              {/* Critérios de CNAE */}
              <div className="space-y-2">
                <Label htmlFor="cnaes">CNAEs Aceitos</Label>
                <Input
                  id="cnaes"
                  placeholder="6201501, 7319003"
                  value={criteria.requiredCnaes?.join(', ') || ''}
                  onChange={(e) => setCriteria(prev => ({
                    ...prev,
                    requiredCnaes: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  }))}
                />
              </div>

              {/* Capital Social Mínimo */}
              <div className="space-y-2">
                <Label htmlFor="minCapital">Capital Social Mínimo (R$)</Label>
                <Input
                  id="minCapital"
                  type="number"
                  placeholder="10000"
                  value={criteria.minCapitalSocial || ''}
                  onChange={(e) => setCriteria(prev => ({
                    ...prev,
                    minCapitalSocial: parseInt(e.target.value) || 0
                  }))}
                />
              </div>

              {/* Capital Social Máximo */}
              <div className="space-y-2">
                <Label htmlFor="maxCapital">Capital Social Máximo (R$)</Label>
                <Input
                  id="maxCapital"
                  type="number"
                  placeholder="1000000"
                  value={criteria.maxCapitalSocial || ''}
                  onChange={(e) => setCriteria(prev => ({
                    ...prev,
                    maxCapitalSocial: parseInt(e.target.value) || undefined
                  }))}
                />
              </div>

              {/* Situações Excluídas */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="excluded">Situações Excluídas</Label>
                <Input
                  id="excluded"
                  placeholder="BAIXADA, SUSPENSA, INAPTA"
                  value={criteria.excludedSituacoes?.join(', ') || ''}
                  onChange={(e) => setCriteria(prev => ({
                    ...prev,
                    excludedSituacoes: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  }))}
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Pipeline Status */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline de Qualificação</CardTitle>
          <CardDescription>
            Fluxo: Lead Novo → Busca de E-mail → Enriquecimento CNPJ → Validação → Lead Qualificado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-primary">📧</div>
              <div className="text-sm font-medium mt-2">Busca de E-mail</div>
              <div className="text-xs text-muted-foreground">Hunter.io + Padrões</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-primary">🏢</div>
              <div className="text-sm font-medium mt-2">Enriquecimento</div>
              <div className="text-xs text-muted-foreground">BrasilAPI + ReceitaWS</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-primary">🎯</div>
              <div className="text-sm font-medium mt-2">Validação</div>
              <div className="text-xs text-muted-foreground">Critérios de Negócio</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-primary">✅</div>
              <div className="text-sm font-medium mt-2">Qualificado</div>
              <div className="text-xs text-muted-foreground">Pronto p/ Campanha</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados da Qualificação</CardTitle>
            <CardDescription>
              Última execução realizada em {new Date().toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{results.processed}</div>
                <div className="text-sm text-muted-foreground">Processados</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{results.qualified}</div>
                <div className="text-sm text-muted-foreground">Qualificados</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">{results.unqualified}</div>
                <div className="text-sm text-muted-foreground">Desqualificados</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-600">{results.errors}</div>
                <div className="text-sm text-muted-foreground">Erros</div>
              </div>
            </div>

            {results.qualified > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Taxa de Qualificação</span>
                  <span className="text-sm text-muted-foreground">
                    {Math.round((results.qualified / results.processed) * 100)}%
                  </span>
                </div>
                <Progress 
                  value={(results.qualified / results.processed) * 100} 
                  className="h-2"
                />
              </div>
            )}

            {results.details.length > 0 && (
              <div>
                <Separator className="my-4" />
                <div className="space-y-2">
                  <h4 className="font-medium">Detalhes por Lead</h4>
                  {results.details.map((detail, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(detail.status)}
                        <div>
                          <div className="font-medium">{detail.empresa}</div>
                          <div className="text-sm text-muted-foreground">Score: {detail.score}%</div>
                        </div>
                      </div>
                      <Badge 
                        variant={detail.qualified ? "default" : "secondary"}
                        className={getStatusColor(detail.status)}
                      >
                        {detail.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LeadQualificationEngine;