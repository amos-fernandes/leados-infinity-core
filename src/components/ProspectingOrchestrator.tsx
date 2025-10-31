import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Play, Database, MapPin, FileSpreadsheet, Building2, Sparkles } from 'lucide-react';

export const ProspectingOrchestrator = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any>(null);
  const [selectedSources, setSelectedSources] = useState({
    rfb: true,
    google_maps: true,
    basededados: true,
    jucesp: false
  });

  const sources = [
    { id: 'rfb', label: 'Receita Federal (RFB)', icon: Database, color: 'bg-blue-500' },
    { id: 'google_maps', label: 'Google Maps', icon: MapPin, color: 'bg-red-500' },
    { id: 'basededados', label: 'Base Dos Dados', icon: FileSpreadsheet, color: 'bg-green-500' },
    { id: 'jucesp', label: 'JUCESP', icon: Building2, color: 'bg-purple-500' }
  ];

  const handleOrchestrate = async () => {
    setIsRunning(true);
    setProgress(0);
    setResults(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Você precisa estar autenticado');
        return;
      }

      const activeSources = Object.entries(selectedSources)
        .filter(([_, enabled]) => enabled)
        .map(([source]) => source);

      if (activeSources.length === 0) {
        toast.error('Selecione pelo menos uma fonte de dados');
        return;
      }

      toast.info('🚀 Iniciando orquestração de prospecção...', {
        description: `Capturando de ${activeSources.length} fontes`
      });

      // Simular progresso
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 5, 95));
      }, 1000);

      const { data, error } = await supabase.functions.invoke('orchestrate-prospecting', {
        body: {
          userId: user.id,
          targetCount: 1000,
          sources: activeSources,
          qualificationCriteria: {
            requiredUfs: ['SP', 'RJ', 'MG', 'SC', 'PR'],
            minCapitalSocial: 10000,
            excludedSituacoes: ['BAIXADA', 'SUSPENSA', 'INAPTA']
          }
        }
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (error) throw error;

      setResults(data);
      
      toast.success('✅ Orquestração concluída!', {
        description: `${data.totalCaptured} suspects capturados, ${data.totalQualified} qualificados`
      });

    } catch (error) {
      console.error('Erro na orquestração:', error);
      toast.error('Erro ao executar orquestração', {
        description: error.message
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Orquestrador de Prospecção
              </CardTitle>
              <CardDescription>
                Sistema automatizado de captação e qualificação de prospects
              </CardDescription>
            </div>
            <Button
              onClick={handleOrchestrate}
              disabled={isRunning}
              size="lg"
            >
              <Play className="h-4 w-4 mr-2" />
              {isRunning ? 'Executando...' : 'Iniciar Captura'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Seleção de Fontes */}
          <div>
            <h3 className="font-semibold mb-3">Fontes de Dados</h3>
            <div className="grid grid-cols-2 gap-4">
              {sources.map(source => {
                const Icon = source.icon;
                return (
                  <div
                    key={source.id}
                    className="flex items-center space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <Checkbox
                      id={source.id}
                      checked={selectedSources[source.id as keyof typeof selectedSources]}
                      onCheckedChange={(checked) =>
                        setSelectedSources(prev => ({ ...prev, [source.id]: checked }))
                      }
                      disabled={isRunning}
                    />
                    <label
                      htmlFor={source.id}
                      className="flex items-center gap-2 cursor-pointer flex-1"
                    >
                      <div className={`p-2 rounded ${source.color} bg-opacity-10`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-medium">{source.label}</span>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Progresso */}
          {isRunning && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progresso</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Resultados */}
          {results && (
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold">Resultados da Orquestração</h3>
              
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-primary">
                        {results.totalCaptured}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Suspects Capturados
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600">
                        {results.totalQualified}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Leads Qualificados
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-600">
                        {results.totalCaptured > 0
                          ? Math.round((results.totalQualified / results.totalCaptured) * 100)
                          : 0}%
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Taxa de Qualificação
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Por Fonte */}
              {Object.keys(results.bySource).length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Capturas por Fonte</h4>
                  <div className="space-y-2">
                    {Object.entries(results.bySource).map(([source, count]) => (
                      <div key={source} className="flex items-center justify-between p-2 rounded bg-muted/50">
                        <span className="capitalize">{source.replace('_', ' ')}</span>
                        <Badge variant="secondary">{count as number} leads</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Erros */}
              {results.errors && results.errors.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 text-destructive">Erros</h4>
                  <div className="space-y-1">
                    {results.errors.map((error: string, idx: number) => (
                      <div key={idx} className="text-sm text-muted-foreground bg-destructive/10 p-2 rounded">
                        {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tempo */}
              <div className="text-sm text-muted-foreground">
                Duração: {results.duration}s
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
