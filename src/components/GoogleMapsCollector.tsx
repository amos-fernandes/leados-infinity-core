import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  MapPin, 
  Search, 
  Building, 
  Phone,
  Mail,
  Globe,
  MessageCircle,
  Star,
  Users,
  Download,
  Filter
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";

interface CollectedBusiness {
  id: string;
  empresa: string;
  telefone?: string;
  email?: string;
  website?: string;
  whatsapp?: string;
  setor: string;
  rating?: number;
  reviews?: number;
  address?: string;
}

const GoogleMapsCollector = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState('Goiânia, GO');
  const [maxResults, setMaxResults] = useState(20);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [collectedBusinesses, setCollectedBusinesses] = useState<CollectedBusiness[]>([]);
  const [totalFound, setTotalFound] = useState(0);

  const collectBusinesses = async () => {
    if (!searchQuery.trim() || !user) {
      toast({
        title: "Erro",
        description: "Digite um termo de busca",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setProgress(0);
    setCollectedBusinesses([]);

    try {
      // Simular progresso
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const { data, error } = await supabase.functions.invoke('google-maps-scraper', {
        body: {
          searchQuery,
          location,
          userId: user.id,
          maxResults
        }
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (error) throw error;

      if (data.success) {
        setCollectedBusinesses(data.leads || []);
        setTotalFound(data.totalFound);
        
        toast({
          title: "Sucesso",
          description: data.message,
        });
      }
    } catch (error) {
      console.error('Erro ao coletar dados:', error);
      toast({
        title: "Erro",
        description: "Erro ao coletar dados do Google Maps",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      if (!loading) setProgress(0);
    }
  };

  const exportToCSV = () => {
    if (collectedBusinesses.length === 0) return;

    const csvContent = [
      ['Empresa', 'Telefone', 'Email', 'Website', 'WhatsApp', 'Setor', 'Avaliação', 'Reviews', 'Endereço'].join(','),
      ...collectedBusinesses.map(business => [
        business.empresa,
        business.telefone || '',
        business.email || '',
        business.website || '',
        business.whatsapp || '',
        business.setor,
        business.rating || '',
        business.reviews || '',
        business.address || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `leads_google_maps_${searchQuery}_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Formulário de Coleta */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-500" />
            Coletor Google Maps - Leads
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Termo de Busca</Label>
              <Input
                id="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ex: Restaurante, Clínica, Advogado"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Localização</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex: Goiânia, GO"
                disabled={loading}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxResults">Máximo de Resultados</Label>
              <Input
                id="maxResults"
                type="number"
                value={maxResults}
                onChange={(e) => setMaxResults(Number(e.target.value))}
                min="1"
                max="100"
                disabled={loading}
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={collectBusinesses} 
                disabled={loading}
                className="w-full"
              >
                <Search className="h-4 w-4 mr-2" />
                {loading ? 'Coletando...' : 'Buscar no Google Maps'}
              </Button>
            </div>
          </div>

          {loading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Coletando dados...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resultados */}
      {collectedBusinesses.length > 0 && (
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="h-5 w-5 text-green-500" />
                Empresas Coletadas
                <Badge variant="default">{collectedBusinesses.length}</Badge>
              </div>
              <Button variant="outline" onClick={exportToCSV}>
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200">
              <p className="text-sm text-green-700">
                <strong>{collectedBusinesses.length}</strong> empresas salvas de <strong>{totalFound}</strong> encontradas
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
              {collectedBusinesses.map((business) => (
                <div key={business.id} className="p-4 border rounded-lg bg-muted/50">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">{business.empresa}</h4>
                    
                    {business.telefone && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {business.telefone}
                      </div>
                    )}
                    
                    {business.email && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {business.email}
                      </div>
                    )}
                    
                    {business.website && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Globe className="h-3 w-3" />
                        <span className="truncate">Site</span>
                      </div>
                    )}
                    
                    {business.whatsapp && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MessageCircle className="h-3 w-3" />
                        WhatsApp
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t">
                      <Badge variant="secondary" className="text-xs">
                        {business.setor}
                      </Badge>
                      
                      {business.rating && (
                        <div className="flex items-center gap-1 text-xs">
                          <Star className="h-3 w-3 text-yellow-500 fill-current" />
                          {business.rating}
                          {business.reviews && (
                            <span className="text-muted-foreground">({business.reviews})</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
              <h4 className="font-medium text-blue-800 mb-2">Informações Coletadas</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="text-center">
                  <p className="font-bold text-blue-700">{collectedBusinesses.filter(b => b.telefone).length}</p>
                  <p className="text-blue-600">Com Telefone</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-blue-700">{collectedBusinesses.filter(b => b.email).length}</p>
                  <p className="text-blue-600">Com Email</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-blue-700">{collectedBusinesses.filter(b => b.website).length}</p>
                  <p className="text-blue-600">Com Website</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-blue-700">{collectedBusinesses.filter(b => b.whatsapp).length}</p>
                  <p className="text-blue-600">Com WhatsApp</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dicas e Configurações */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-purple-500" />
            Dicas de Uso
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-medium">Termos de Busca Eficazes</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• "Restaurante italiano" - específico e direcionado</li>
                <li>• "Clínica veterinária" - setor com necessidades claras</li>
                <li>• "Escritório de advocacia" - B2B com potencial</li>
                <li>• "Loja de roupas" - varejo local</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium">Configurações Recomendadas</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Máximo 20-50 resultados por busca</li>
                <li>• Use localizações específicas</li>
                <li>• Termos em português para melhores resultados</li>
                <li>• Combine com campanhas WhatsApp automatizadas</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
            <p className="text-sm text-yellow-700">
              <strong>Importante:</strong> Use esta ferramenta de forma responsável. Respeite a LGPD e sempre 
              tenha permissão antes de entrar em contato com as empresas coletadas.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GoogleMapsCollector;