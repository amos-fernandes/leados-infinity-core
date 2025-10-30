import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { parseCompaniesCSV, importDailyCompanies } from "@/utils/dailyCompaniesImporter";
import { Download, Upload, AlertTriangle, CheckCircle, Building2, TrendingUp, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function DailyCompaniesManager() {
  const { user } = useAuth();
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedState, setSelectedState] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadCompanies();
      loadStats();
    }
  }, [user, selectedDate, selectedState]);

  const loadCompanies = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('daily_new_companies')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (selectedDate) {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        query = query.eq('data_abertura', dateStr);
      }

      if (selectedState && selectedState !== "all") {
        query = query.eq('estado', selectedState);
      }

      const { data, error } = await query;

      if (error) throw error;
      setCompanies(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar empresas:', error);
      toast.error('Erro ao carregar empresas');
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const { data, error } = await supabase
        .from('daily_companies_stats')
        .select('*')
        .eq('user_id', user?.id)
        .order('data_referencia', { ascending: false })
        .limit(30);

      if (error) throw error;
      setStats(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setProgress(0);
    setResult(null);

    try {
      toast.info('Lendo arquivo...');
      const text = await file.text();
      
      toast.info('Processando dados...');
      const parsedCompanies = await parseCompaniesCSV(text);
      
      if (parsedCompanies.length === 0) {
        throw new Error('Nenhuma empresa válida encontrada no arquivo');
      }

      toast.success(`${parsedCompanies.length} empresas prontas para importação`);
      
      const dataRef = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
      
      const importResult = await importDailyCompanies(
        parsedCompanies,
        'upload_csv',
        dataRef,
        (current, total) => {
          setProgress((current / total) * 100);
        }
      );

      setResult(importResult);
      
      if (importResult.success > 0) {
        toast.success(`${importResult.success} empresas importadas com sucesso!`);
        
        if (importResult.anomalias_temporais > 0) {
          toast.warning(`⚠️ ${importResult.anomalias_temporais} anomalias temporais detectadas (datas futuras)`);
        }
        
        loadCompanies();
        loadStats();
      }

      if (importResult.errors > 0) {
        toast.error(`${importResult.errors} erros durante a importação`);
      }

    } catch (error: any) {
      console.error('Erro na importação:', error);
      toast.error(error.message || 'Erro ao importar arquivo');
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };

  const exportToCSV = () => {
    if (companies.length === 0) {
      toast.error('Nenhuma empresa para exportar');
      return;
    }

    const headers = [
      'CNPJ', 'Razão Social', 'Nome Fantasia', 'Data Abertura', 'Estado', 'Cidade',
      'Porte', 'Situação', 'Anomalia Temporal'
    ];

    const rows = companies.map(c => [
      c.cnpj,
      c.razao_social,
      c.nome_fantasia || '',
      c.data_abertura,
      c.estado,
      c.cidade || '',
      c.porte || '',
      c.situacao_cadastral || '',
      c.anomalia_temporal ? 'SIM' : 'NÃO'
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `empresas_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();

    toast.success('Arquivo exportado com sucesso!');
  };

  const totalEmpresas = stats.reduce((sum, s) => sum + s.total_empresas, 0);
  const anomalias = companies.filter(c => c.anomalia_temporal).length;
  const validadas = companies.filter(c => c.dados_validados).length;

  return (
    <div className="space-y-6">
      {/* Header com Cards de Estatísticas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Empresas</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEmpresas.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Hoje</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {companies.filter(c => c.data_abertura === format(new Date(), 'yyyy-MM-dd')).length}
            </div>
            <p className="text-xs text-muted-foreground">Novas empresas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Anomalias Temporais</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{anomalias}</div>
            <p className="text-xs text-muted-foreground">Datas futuras detectadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Validadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{validadas}</div>
            <p className="text-xs text-muted-foreground">Dados verificados</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="import" className="space-y-4">
        <TabsList>
          <TabsTrigger value="import">Importação</TabsTrigger>
          <TabsTrigger value="companies">Empresas</TabsTrigger>
          <TabsTrigger value="stats">Estatísticas</TabsTrigger>
        </TabsList>

        {/* Tab de Importação */}
        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Importar Novas Empresas</CardTitle>
              <CardDescription>
                Faça upload de um arquivo CSV com dados de empresas abertas. 
                O sistema detectará automaticamente anomalias temporais (datas futuras).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="date-filter">Data de Referência</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "PPP", { locale: ptBR }) : "Selecione uma data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="file-upload">Arquivo CSV</Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  disabled={isImporting}
                />
              </div>

              {isImporting && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  <p className="text-sm text-muted-foreground text-center">
                    Importando... {Math.round(progress)}%
                  </p>
                </div>
              )}

              {result && (
                <Alert>
                  <AlertDescription>
                    <div className="space-y-1">
                      <p>✅ Sucesso: {result.success} empresas</p>
                      <p>❌ Erros: {result.errors}</p>
                      <p>⚠️ Anomalias Temporais: {result.anomalias_temporais}</p>
                      {result.messages.length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm font-medium">
                            Ver detalhes
                          </summary>
                          <ul className="mt-2 space-y-1 text-xs">
                            {result.messages.map((msg: string, i: number) => (
                              <li key={i}>{msg}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <Alert>
                <AlertDescription className="text-xs">
                  <strong>Formato esperado do CSV:</strong><br />
                  Colunas obrigatórias: cnpj, razao_social, data_abertura, estado<br />
                  Formato de data: DD/MM/YYYY ou YYYY-MM-DD<br />
                  <br />
                  <strong>⚠️ Detecção de Anomalias:</strong><br />
                  Empresas com data de abertura futura serão marcadas automaticamente como anomalias temporais.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab de Empresas */}
        <TabsContent value="companies" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Empresas Importadas</CardTitle>
                  <CardDescription>{companies.length} empresas encontradas</CardDescription>
                </div>
                <Button onClick={exportToCSV} variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Exportar CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Razão Social</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Data Abertura</TableHead>
                      <TableHead>Porte</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.map((company) => (
                      <TableRow key={company.id}>
                        <TableCell className="font-mono text-xs">{company.cnpj}</TableCell>
                        <TableCell>{company.razao_social}</TableCell>
                        <TableCell>{company.estado}</TableCell>
                        <TableCell>{format(new Date(company.data_abertura), 'dd/MM/yyyy')}</TableCell>
                        <TableCell>{company.porte || '-'}</TableCell>
                        <TableCell>
                          {company.anomalia_temporal && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              Anomalia Temporal
                            </Badge>
                          )}
                          {company.dados_validados && (
                            <Badge variant="default" className="text-xs">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Validado
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab de Estatísticas */}
        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Estatísticas por Estado e Data</CardTitle>
              <CardDescription>Agregação diária de empresas abertas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>MEI</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.map((stat) => (
                      <TableRow key={stat.id}>
                        <TableCell>{format(new Date(stat.data_referencia), 'dd/MM/yyyy')}</TableCell>
                        <TableCell>{stat.estado}</TableCell>
                        <TableCell className="font-bold">{stat.total_empresas}</TableCell>
                        <TableCell>{stat.total_mei || 0}</TableCell>
                        <TableCell>
                          {stat.tem_anomalia && (
                            <Badge variant="outline" className="text-xs text-yellow-600">
                              Com Anomalias
                            </Badge>
                          )}
                          {stat.dados_validados && (
                            <Badge variant="outline" className="text-xs text-green-600">
                              Validado
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
