import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Wifi,
  WifiOff
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface TestResult {
  test: string;
  status: 'success' | 'error' | 'pending';
  message: string;
  duration?: number;
}

const SupabaseConnectionTest = () => {
  const { user } = useAuth();
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [overallStatus, setOverallStatus] = useState<'connected' | 'disconnected' | 'unknown'>('unknown');

  const runTests = async () => {
    setTesting(true);
    setResults([]);
    const testResults: TestResult[] = [];

    // Test 1: Basic Connection
    const startTime = Date.now();
    try {
      testResults.push({ test: "Conexão Básica", status: 'pending', message: "Testando..." });
      setResults([...testResults]);

      const { error } = await supabase.from('campaigns').select('count').limit(1);
      const duration = Date.now() - startTime;
      
      if (error) {
        testResults[0] = { test: "Conexão Básica", status: 'error', message: `Erro: ${error.message}`, duration };
      } else {
        testResults[0] = { test: "Conexão Básica", status: 'success', message: "Conectado com sucesso!", duration };
      }
      setResults([...testResults]);
    } catch (error) {
      testResults[0] = { test: "Conexão Básica", status: 'error', message: `Erro de rede: ${error}` };
      setResults([...testResults]);
    }

    // Test 2: Authentication
    try {
      testResults.push({ test: "Autenticação", status: 'pending', message: "Verificando..." });
      setResults([...testResults]);

      const { data: { session } } = await supabase.auth.getSession();
      
      if (session && user) {
        testResults[1] = { test: "Autenticação", status: 'success', message: `Usuário autenticado: ${user.email}` };
      } else {
        testResults[1] = { test: "Autenticação", status: 'error', message: "Usuário não autenticado" };
      }
      setResults([...testResults]);
    } catch (error) {
      testResults[1] = { test: "Autenticação", status: 'error', message: `Erro: ${error}` };
      setResults([...testResults]);
    }

    // Test 3: Database Read
    if (user) {
      try {
        testResults.push({ test: "Leitura do Banco", status: 'pending', message: "Testando leitura..." });
        setResults([...testResults]);

        const { data, error } = await supabase
          .from('leads')
          .select('count')
          .eq('user_id', user.id);

        if (error) {
          testResults[2] = { test: "Leitura do Banco", status: 'error', message: `Erro: ${error.message}` };
        } else {
          testResults[2] = { test: "Leitura do Banco", status: 'success', message: "Leitura funcionando!" };
        }
        setResults([...testResults]);
      } catch (error) {
        testResults[2] = { test: "Leitura do Banco", status: 'error', message: `Erro: ${error}` };
        setResults([...testResults]);
      }
    }

    // Test 4: Real-time Connection
    try {
      testResults.push({ test: "Tempo Real", status: 'pending', message: "Testando websocket..." });
      setResults([...testResults]);

      const channel = supabase.channel('test-channel');
      
      const subscription = channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          testResults[testResults.length - 1] = { test: "Tempo Real", status: 'success', message: "WebSocket conectado!" };
        } else {
          testResults[testResults.length - 1] = { test: "Tempo Real", status: 'error', message: `Status: ${status}` };
        }
        setResults([...testResults]);
      });

      // Timeout para o teste de real-time
      setTimeout(() => {
        supabase.removeChannel(channel);
        if (testResults[testResults.length - 1]?.status === 'pending') {
          testResults[testResults.length - 1] = { test: "Tempo Real", status: 'error', message: "Timeout na conexão" };
          setResults([...testResults]);
        }
      }, 5000);

    } catch (error) {
      testResults[testResults.length - 1] = { test: "Tempo Real", status: 'error', message: `Erro: ${error}` };
      setResults([...testResults]);
    }

    // Determinar status geral
    const hasErrors = testResults.some(r => r.status === 'error');
    setOverallStatus(hasErrors ? 'disconnected' : 'connected');
    
    if (hasErrors) {
      toast.error("Alguns testes falharam. Verifique as configurações.");
    } else {
      toast.success("Todos os testes passaram! Conexão funcionando perfeitamente.");
    }

    setTesting(false);
  };

  const getStatusIcon = (status: 'success' | 'error' | 'pending') => {
    switch (status) {
      case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'pending': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
    }
  };

  const getOverallStatusIcon = () => {
    switch (overallStatus) {
      case 'connected': return <Wifi className="h-5 w-5 text-green-500" />;
      case 'disconnected': return <WifiOff className="h-5 w-5 text-red-500" />;
      default: return <Database className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getOverallStatusIcon()}
            Teste de Conexão Supabase
          </div>
          <Badge 
            variant={overallStatus === 'connected' ? 'default' : overallStatus === 'disconnected' ? 'destructive' : 'secondary'}
          >
            {overallStatus === 'connected' ? 'Conectado' : overallStatus === 'disconnected' ? 'Desconectado' : 'Desconhecido'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Teste completo da conexão e funcionalidades do Supabase
          </p>
          <Button 
            onClick={runTests} 
            disabled={testing}
            size="sm"
          >
            {testing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <Database className="h-4 w-4 mr-2" />
                Testar Conexão
              </>
            )}
          </Button>
        </div>

        {results.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium">Resultados dos Testes:</h4>
            {results.map((result, index) => (
              <div 
                key={index} 
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(result.status)}
                  <div>
                    <p className="font-medium text-sm">{result.test}</p>
                    <p className="text-xs text-muted-foreground">{result.message}</p>
                  </div>
                </div>
                {result.duration && (
                  <span className="text-xs text-muted-foreground">
                    {result.duration}ms
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {results.length === 0 && (
          <div className="text-center py-8">
            <Database className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">Clique em "Testar Conexão" para verificar o status do Supabase</p>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>URL:</strong> https://ibaonnnakuuerrgtilze.supabase.co</p>
          <p><strong>Projeto:</strong> ibaonnnakuuerrgtilze</p>
          {user && <p><strong>Usuário:</strong> {user.email}</p>}
        </div>
      </CardContent>
    </Card>
  );
};

export default SupabaseConnectionTest;