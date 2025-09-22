import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MapPin, Globe, Instagram, Facebook, Zap, CheckCircle, AlertCircle, Phone } from 'lucide-react';

interface CollectorResult {
  type: string;
  success: boolean;
  leads: any[];
  message: string;
  error?: string;
}

export const ProspectCollector: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [isCollecting, setIsCollecting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<CollectorResult[]>([]);
  
  // Google Maps
  const [mapsQuery, setMapsQuery] = useState('');
  const [mapsLocation, setMapsLocation] = useState('');
  
  // Sites Institucionais
  const [websites, setWebsites] = useState('');
  
  // Validação WhatsApp
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [numbersToValidate, setNumbersToValidate] = useState('');
  const [validatedNumbers, setValidatedNumbers] = useState<any[]>([]);

  const collectFromGoogleMaps = async () => {
    if (!mapsQuery.trim()) {
      toast({
        title: "Erro",
        description: "Digite uma busca para o Google Maps",
        variant: "destructive"
      });
      return;
    }

    try {
      setProgress(25);
      
      const { data, error } = await supabase.functions.invoke('scrape-google-maps', {
        body: {
          searchQuery: mapsQuery,
          location: mapsLocation,
          userId: user?.id,
          campaignId: null
        }
      });

      if (error) throw error;

      const result: CollectorResult = {
        type: 'Google Maps',
        success: data.success,
        leads: data.leads || [],
        message: data.message || `${data.leads?.length || 0} leads coletados`,
        error: data.error
      };

      setResults(prev => [...prev, result]);
      
      toast({
        title: "Google Maps",
        description: result.message,
        variant: result.success ? "default" : "destructive"
      });

    } catch (error: any) {
      const result: CollectorResult = {
        type: 'Google Maps',
        success: false,
        leads: [],
        message: 'Erro na coleta',
        error: error.message
      };
      
      setResults(prev => [...prev, result]);
      
      toast({
        title: "Erro - Google Maps",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const collectFromWebsites = async () => {
    if (!websites.trim()) {
      toast({
        title: "Erro",
        description: "Digite pelo menos um site para fazer scraping",
        variant: "destructive"
      });
      return;
    }

    try {
      setProgress(50);
      
      const websiteList = websites.split('\n')
        .map(site => site.trim())
        .filter(site => site.length > 0)
        .map(site => {
          if (!site.startsWith('http')) {
            return `https://${site}`;
          }
          return site;
        });

      const { data, error } = await supabase.functions.invoke('scrape-websites', {
        body: {
          websites: websiteList,
          userId: user?.id,
          campaignId: null
        }
      });

      if (error) throw error;

      const result: CollectorResult = {
        type: 'Sites Institucionais',
        success: data.success,
        leads: data.leads || [],
        message: data.message || `${data.leads?.length || 0} leads coletados`,
        error: data.error
      };

      setResults(prev => [...prev, result]);
      
      toast({
        title: "Sites Institucionais",
        description: result.message,
        variant: result.success ? "default" : "destructive"
      });

    } catch (error: any) {
      const result: CollectorResult = {
        type: 'Sites Institucionais',
        success: false,
        leads: [],
        message: 'Erro na coleta',
        error: error.message
      };
      
      setResults(prev => [...prev, result]);
      
      toast({
        title: "Erro - Sites",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const validateWhatsAppNumbers = async () => {
    if (!phoneNumberId.trim() || !numbersToValidate.trim()) {
      toast({
        title: "Erro",
        description: "Configure o Phone Number ID e digite números para validar",
        variant: "destructive"
      });
      return;
    }

    try {
      setProgress(75);
      
      const numbers = numbersToValidate.split('\n')
        .map(num => num.trim())
        .filter(num => num.length > 0);

      const validationResults = [];
      
      for (const number of numbers.slice(0, 10)) { // Limitar a 10 por vez
        try {
          const { data, error } = await supabase.functions.invoke('validate-whatsapp-number', {
            body: {
              phone: number,
              phoneNumberId: phoneNumberId
            }
          });

          if (error) throw error;
          
          validationResults.push({
            phone: number,
            valid: data.valid,
            formatted: data.phone,
            error: data.error,
            messageId: data.messageId
          });

        } catch (numError: any) {
          validationResults.push({
            phone: number,
            valid: false,
            error: numError.message
          });
        }
      }

      setValidatedNumbers(validationResults);
      
      const validCount = validationResults.filter(r => r.valid).length;
      
      toast({
        title: "Validação WhatsApp",
        description: `${validCount} de ${validationResults.length} números são válidos`,
        variant: validCount > 0 ? "default" : "destructive"
      });

    } catch (error: any) {
      toast({
        title: "Erro - Validação",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const collectAllSources = async () => {
    setIsCollecting(true);
    setProgress(0);
    setResults([]);
    
    try {
      // Executar todas as coletas em sequência
      if (mapsQuery.trim()) {
        await collectFromGoogleMaps();
      }
      
      if (websites.trim()) {
        await collectFromWebsites();
      }
      
      setProgress(100);
      
      toast({
        title: "Coleta Finalizada",
        description: "Todos os métodos de coleta foram executados",
        variant: "default"
      });

    } catch (error: any) {
      toast({
        title: "Erro na Coleta",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsCollecting(false);
    }
  };

  const totalLeads = results.reduce((sum, result) => sum + result.leads.length, 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Coletor de Prospects</h1>
          <p className="text-muted-foreground">
            Colete números WhatsApp de múltiplas fontes e valide automaticamente
          </p>
        </div>
        
        <Button 
          onClick={collectAllSources}
          disabled={isCollecting}
          className="bg-gradient-primary hover:opacity-90"
        >
          {isCollecting ? (
            <>
              <Zap className="w-4 h-4 mr-2 animate-spin" />
              Coletando...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              Coletar Todos
            </>
          )}
        </Button>
      </div>

      {isCollecting && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Progresso da Coleta</span>
                <span className="text-sm text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="google-maps" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="google-maps" className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Google Maps
          </TabsTrigger>
          <TabsTrigger value="websites" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Sites
          </TabsTrigger>
          <TabsTrigger value="social" className="flex items-center gap-2">
            <Instagram className="w-4 h-4" />
            Redes Sociais
          </TabsTrigger>
          <TabsTrigger value="validate" className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Validar WhatsApp
          </TabsTrigger>
        </TabsList>

        <TabsContent value="google-maps">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Google Maps & Google Meu Negócio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="maps-query">Busca no Google Maps *</Label>
                  <Input
                    id="maps-query"
                    placeholder="Ex: restaurantes, clínicas, escritórios"
                    value={mapsQuery}
                    onChange={(e) => setMapsQuery(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="maps-location">Localização (opcional)</Label>
                  <Input
                    id="maps-location"
                    placeholder="Ex: São Paulo, SP"
                    value={mapsLocation}
                    onChange={(e) => setMapsLocation(e.target.value)}
                  />
                </div>
              </div>
              
              <Button 
                onClick={collectFromGoogleMaps}
                disabled={isCollecting || !mapsQuery.trim()}
                className="w-full"
              >
                Coletar do Google Maps
              </Button>
              
              <div className="text-sm text-muted-foreground">
                <p>• Busca empresas no Google Maps com a query especificada</p>
                <p>• Extrai telefones e identifica possíveis números WhatsApp</p>
                <p>• Filtra apenas números móveis brasileiros</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="websites">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Sites Institucionais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="websites">Sites para Fazer Scraping *</Label>
                <Textarea
                  id="websites"
                  placeholder="Digite um site por linha:&#10;exemplo.com&#10;https://outraempresa.com.br&#10;www.terceira.com"
                  value={websites}
                  onChange={(e) => setWebsites(e.target.value)}
                  rows={6}
                />
              </div>
              
              <Button 
                onClick={collectFromWebsites}
                disabled={isCollecting || !websites.trim()}
                className="w-full"
              >
                Fazer Scraping dos Sites
              </Button>
              
              <div className="text-sm text-muted-foreground">
                <p>• Acessa páginas: /, /contato, /sobre, /fale-conosco</p>
                <p>• Busca links WhatsApp: api.whatsapp.com/send, wa.me</p>
                <p>• Extrai telefones e emails de contato</p>
                <p>• Identifica botões flutuantes de WhatsApp</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Instagram className="w-5 h-5" />
                Instagram & Facebook
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-yellow-800 mb-2">
                  <AlertCircle className="w-4 h-4" />
                  <span className="font-semibold">Em Desenvolvimento</span>
                </div>
                <p className="text-sm text-yellow-700">
                  Esta funcionalidade será implementada em breve. Utilizará:
                </p>
                <ul className="text-sm text-yellow-700 mt-2 space-y-1">
                  <li>• Apify Instagram Scraper para perfis públicos</li>
                  <li>• PhantomBuster para automação de coleta</li>
                  <li>• Extração de contatos de bio e stories</li>
                  <li>• Foco em perfis comerciais verificados</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validate">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Validar Números WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="phone-number-id">Phone Number ID (WhatsApp Business) *</Label>
                <Input
                  id="phone-number-id"
                  placeholder="Ex: 123456789012345"
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="numbers-validate">Números para Validar *</Label>
                <Textarea
                  id="numbers-validate"
                  placeholder="Digite um número por linha:&#10;11999887766&#10;21987654321&#10;+55 11 98765-4321"
                  value={numbersToValidate}
                  onChange={(e) => setNumbersToValidate(e.target.value)}
                  rows={6}
                />
              </div>
              
              <Button 
                onClick={validateWhatsAppNumbers}
                disabled={!phoneNumberId.trim() || !numbersToValidate.trim()}
                className="w-full"
              >
                Validar Números WhatsApp
              </Button>

              {validatedNumbers.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold">Resultados da Validação:</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {validatedNumbers.map((result, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm font-mono">{result.phone}</span>
                        <div className="flex items-center gap-2">
                          {result.valid ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Válido
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Inválido
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="text-sm text-muted-foreground">
                <p>• Usa a API oficial do WhatsApp Business</p>
                <p>• Verifica se o número tem WhatsApp ativo</p>
                <p>• Retorna status de entrega da mensagem de teste</p>
                <p>• ⚠️ Consome créditos da sua conta WhatsApp Business</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Resultados */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados da Coleta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{totalLeads}</div>
                <div className="text-sm text-blue-600">Total de Leads</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {results.filter(r => r.success).length}
                </div>
                <div className="text-sm text-green-600">Fontes com Sucesso</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {results.filter(r => !r.success).length}
                </div>
                <div className="text-sm text-red-600">Fontes com Erro</div>
              </div>
            </div>
            
            <div className="space-y-3">
              {results.map((result, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={result.success ? "default" : "destructive"}>
                        {result.type}
                      </Badge>
                      <span className="text-sm">{result.message}</span>
                    </div>
                    <div className="text-sm font-semibold">
                      {result.leads.length} leads
                    </div>
                  </div>
                  
                  {result.error && (
                    <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                      Erro: {result.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};