import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Upload, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { parseCNPJCSV, importCNPJToLeads } from '@/utils/cnpjImporter';
import { supabase } from '@/integrations/supabase/client';

export function CNPJImporter() {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ success: number; errors: number; messages: string[] } | null>(null);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Verificar se é CSV
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: 'Formato inválido',
        description: 'Por favor, selecione um arquivo CSV',
        variant: 'destructive'
      });
      return;
    }

    setIsImporting(true);
    setProgress(0);
    setResult(null);

    try {
      // Obter usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Ler arquivo
      const fileContent = await file.text();
      
      toast({
        title: 'Processando arquivo...',
        description: 'Analisando dados do CSV'
      });

      // Parse CSV
      const records = await parseCNPJCSV(fileContent);
      
      if (records.length === 0) {
        throw new Error('Nenhum registro válido encontrado no arquivo');
      }

      toast({
        title: `${records.length} registros encontrados`,
        description: 'Iniciando importação como leads qualificados...'
      });

      // Importar para o banco de dados
      const importResult = await importCNPJToLeads(
        records,
        user.id,
        (current, total) => {
          setProgress((current / total) * 100);
        }
      );

      setResult(importResult);
      setProgress(100);

      if (importResult.errors === 0) {
        toast({
          title: 'Importação concluída!',
          description: `${importResult.success} leads importados com sucesso como qualificados com WhatsApp configurado.`,
        });
      } else {
        toast({
          title: 'Importação concluída com erros',
          description: `${importResult.success} sucesso, ${importResult.errors} erros`,
          variant: 'destructive'
        });
      }

    } catch (error) {
      console.error('Erro na importação:', error);
      toast({
        title: 'Erro na importação',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      });
    } finally {
      setIsImporting(false);
      // Limpar input
      event.target.value = '';
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6 text-primary" />
          <h3 className="text-lg font-semibold">Importação de Base CNPJ</h3>
        </div>

        <p className="text-sm text-muted-foreground">
          Importe uma base de dados CNPJ em formato CSV. Os leads serão importados como <strong>qualificados</strong> com o telefone principal configurado como <strong>WhatsApp</strong>.
        </p>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={isImporting}
              className="flex-1"
            />
            <Button disabled={isImporting} onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Selecionar Arquivo
            </Button>
          </div>

          {isImporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Importando...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {result && (
            <div className="space-y-2 p-4 border rounded-lg">
              <div className="flex items-center gap-2">
                {result.errors === 0 ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                )}
                <span className="font-semibold">Resultado da Importação</span>
              </div>
              
              <div className="text-sm space-y-1">
                <p className="text-green-600">✓ {result.success} leads importados com sucesso</p>
                {result.errors > 0 && (
                  <p className="text-red-600">✗ {result.errors} erros</p>
                )}
              </div>

              {result.messages.length > 0 && (
                <div className="mt-2 p-2 bg-muted rounded text-xs space-y-1">
                  {result.messages.map((msg, idx) => (
                    <p key={idx}>{msg}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="text-xs text-muted-foreground bg-muted p-3 rounded">
          <strong>Formato esperado:</strong> Arquivo CSV com colunas: CNPJ, Razão Social, Porte, Capital Social, Nome Fantasia, Telefone Principal, E-mail, Cidade, Estado, Atividade Principal, etc.
        </div>
      </div>
    </Card>
  );
}
