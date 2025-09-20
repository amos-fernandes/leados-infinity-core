import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, 
  Search, 
  Download, 
  Edit, 
  Trash2,
  Target,
  DollarSign,
  Calendar,
  TrendingUp
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { exportOpportunitiesToCSV } from "@/utils/csvExport";

const opportunitySchema = z.object({
  titulo: z.string().min(1, "Título é obrigatório"),
  empresa: z.string().min(1, "Empresa é obrigatória"),
  contato_id: z.string().optional(),
  valor: z.string().optional(),
  probabilidade: z.string().default("25"),
  estagio: z.string().default("lead"),
  data_fechamento_esperada: z.string().optional(),
  observacoes: z.string().optional()
});

type OpportunityFormData = z.infer<typeof opportunitySchema>;

interface Opportunity {
  id: string;
  titulo: string;
  empresa: string;
  contato_id?: string;
  valor?: number;
  probabilidade: number;
  estagio: string;
  data_fechamento_esperada?: string;
  observacoes?: string;
  created_at: string;
  updated_at: string;
}

interface Contact {
  id: string;
  nome: string;
  empresa?: string;
}

interface OpportunitiesManagerProps {
  onStatsUpdate: () => void;
}

const OpportunitiesManager = ({ onStatsUpdate }: OpportunitiesManagerProps) => {
  const { user } = useAuth();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState<Opportunity | null>(null);

  const form = useForm<OpportunityFormData>({
    resolver: zodResolver(opportunitySchema),
    defaultValues: {
      titulo: "",
      empresa: "",
      contato_id: "",
      valor: "",
      probabilidade: "25",
      estagio: "lead",
      data_fechamento_esperada: "",
      observacoes: ""
    }
  });

  useEffect(() => {
    if (user) {
      loadOpportunities();
      loadContacts();
    }
  }, [user]);

  const loadOpportunities = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('opportunities')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOpportunities(data || []);
    } catch (error) {
      console.error('Erro ao carregar oportunidades:', error);
      toast.error('Erro ao carregar oportunidades');
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, nome, empresa')
        .eq('user_id', user.id)
        .eq('status', 'ativo');

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
    }
  };

  const handleSubmit = async (data: OpportunityFormData) => {
    if (!user) return;

    try {
      setLoading(true);

      const opportunityData = {
        ...data,
        valor: data.valor ? parseFloat(data.valor) : null,
        probabilidade: parseInt(data.probabilidade),
        contato_id: data.contato_id || null,
        user_id: user.id
      };

      if (editingOpportunity) {
        // Atualizar oportunidade existente
        const { error } = await supabase
          .from('opportunities')
          .update(opportunityData)
          .eq('id', editingOpportunity.id)
          .eq('user_id', user.id);

        if (error) throw error;
        toast.success('Oportunidade atualizada com sucesso!');
      } else {
        // Criar nova oportunidade
        const { error } = await supabase
          .from('opportunities')
          .insert({ 
            ...opportunityData,
            empresa: opportunityData.empresa || 'Nova Oportunidade',
            titulo: opportunityData.titulo || 'Oportunidade',
          });

        if (error) throw error;
        toast.success('Oportunidade criada com sucesso!');
      }

      form.reset();
      setIsDialogOpen(false);
      setEditingOpportunity(null);
      loadOpportunities();
      onStatsUpdate();
    } catch (error) {
      console.error('Erro ao salvar oportunidade:', error);
      toast.error('Erro ao salvar oportunidade');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (opportunity: Opportunity) => {
    setEditingOpportunity(opportunity);
    form.reset({
      titulo: opportunity.titulo,
      empresa: opportunity.empresa,
      contato_id: opportunity.contato_id || "",
      valor: opportunity.valor?.toString() || "",
      probabilidade: opportunity.probabilidade.toString(),
      estagio: opportunity.estagio,
      data_fechamento_esperada: opportunity.data_fechamento_esperada || "",
      observacoes: opportunity.observacoes || ""
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (opportunityId: string) => {
    if (!user || !confirm('Tem certeza que deseja excluir esta oportunidade?')) return;

    try {
      const { error } = await supabase
        .from('opportunities')
        .delete()
        .eq('id', opportunityId)
        .eq('user_id', user.id);

      if (error) throw error;
      toast.success('Oportunidade excluída com sucesso!');
      loadOpportunities();
      onStatsUpdate();
    } catch (error) {
      console.error('Erro ao excluir oportunidade:', error);
      toast.error('Erro ao excluir oportunidade');
    }
  };

  const handleExport = () => {
    exportOpportunitiesToCSV(opportunities);
    toast.success('Oportunidades exportadas com sucesso!');
  };

  const filteredOpportunities = opportunities.filter(opportunity =>
    opportunity.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    opportunity.empresa.toLowerCase().includes(searchTerm.toLowerCase()) ||
    opportunity.estagio.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getEstagioColor = (estagio: string) => {
    switch (estagio) {
      case 'lead': return 'bg-blue-100 text-blue-800';
      case 'contato': return 'bg-yellow-100 text-yellow-800';
      case 'reuniao': return 'bg-purple-100 text-purple-800';
      case 'proposta': return 'bg-orange-100 text-orange-800';
      case 'fechamento': return 'bg-green-100 text-green-800';
      case 'perdido': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getProbabilidadeColor = (probabilidade: number) => {
    if (probabilidade >= 75) return 'text-green-600';
    if (probabilidade >= 50) return 'text-yellow-600';
    if (probabilidade >= 25) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-warning" />
            Pipeline de Vendas
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport} disabled={opportunities.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setEditingOpportunity(null);
                  form.reset();
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Oportunidade
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingOpportunity ? 'Editar Oportunidade' : 'Nova Oportunidade'}
                  </DialogTitle>
                </DialogHeader>
                
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="titulo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Título da Oportunidade *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Ex: Consultoria Tributária" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="empresa"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Empresa *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Nome da empresa" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="contato_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contato</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione um contato" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {contacts.map((contact) => (
                                  <SelectItem key={contact.id} value={contact.id}>
                                    {contact.nome} {contact.empresa && `(${contact.empresa})`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="valor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Valor (R$)</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" step="0.01" placeholder="0.00" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="estagio"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estágio</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="lead">Lead</SelectItem>
                                <SelectItem value="contato">Contato</SelectItem>
                                <SelectItem value="reuniao">Reunião</SelectItem>
                                <SelectItem value="proposta">Proposta</SelectItem>
                                <SelectItem value="fechamento">Fechamento</SelectItem>
                                <SelectItem value="perdido">Perdido</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="probabilidade"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Probabilidade (%)</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="10">10%</SelectItem>
                                <SelectItem value="25">25%</SelectItem>
                                <SelectItem value="50">50%</SelectItem>
                                <SelectItem value="75">75%</SelectItem>
                                <SelectItem value="90">90%</SelectItem>
                                <SelectItem value="100">100%</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="data_fechamento_esperada"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Data Prevista</FormLabel>
                            <FormControl>
                              <Input {...field} type="date" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="observacoes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Observações</FormLabel>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              placeholder="Detalhes sobre a oportunidade, próximos passos, etc..." 
                              rows={3}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end gap-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setIsDialogOpen(false)}
                      >
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={loading}>
                        {loading ? 'Salvando...' : (editingOpportunity ? 'Atualizar' : 'Criar')}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar oportunidades..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Badge variant="outline">
            {filteredOpportunities.length} oportunidades encontradas
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Estágio</TableHead>
                <TableHead>Probabilidade</TableHead>
                <TableHead>Data Prevista</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOpportunities.map((opportunity) => (
                <TableRow key={opportunity.id}>
                  <TableCell className="font-medium">
                    {opportunity.titulo}
                  </TableCell>
                  <TableCell>{opportunity.empresa}</TableCell>
                  <TableCell>
                    {opportunity.valor ? (
                      <div className="flex items-center gap-1 font-medium">
                        <DollarSign className="h-4 w-4 text-success" />
                        R$ {opportunity.valor.toLocaleString('pt-BR')}
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge className={getEstagioColor(opportunity.estagio)} variant="secondary">
                      {opportunity.estagio}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className={`flex items-center gap-1 font-medium ${getProbabilidadeColor(opportunity.probabilidade)}`}>
                      <TrendingUp className="h-4 w-4" />
                      {opportunity.probabilidade}%
                    </div>
                  </TableCell>
                  <TableCell>
                    {opportunity.data_fechamento_esperada ? (
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {new Date(opportunity.data_fechamento_esperada).toLocaleDateString('pt-BR')}
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(opportunity)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(opportunity.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredOpportunities.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'Nenhuma oportunidade encontrada com esse termo' : 'Nenhuma oportunidade cadastrada'}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default OpportunitiesManager;