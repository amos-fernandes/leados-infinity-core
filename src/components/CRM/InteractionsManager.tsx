import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Plus, 
  Calendar, 
  Phone, 
  Mail, 
  MessageSquare, 
  Edit, 
  Trash2,
  Search,
  Filter
} from "lucide-react";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Interaction {
  id: string;
  contact_id: string;
  tipo: string;
  assunto: string;
  descricao: string;
  data_interacao: string;
  created_at: string;
  // Dados do contato
  contact?: {
    nome: string;
    empresa: string;
    email: string;
  };
}

interface InteractionsManagerProps {
  onStatsUpdate?: () => void;
}

const InteractionsManager = ({ onStatsUpdate }: InteractionsManagerProps) => {
  const { user } = useAuth();
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInteraction, setEditingInteraction] = useState<Interaction | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  
  const INTERACTIONS_PER_PAGE = 10;

  const [formData, setFormData] = useState({
    contact_id: "",
    tipo: "",
    assunto: "",
    descricao: "",
    data_interacao: ""
  });

  const interactionTypes = [
    { value: "ligacao", label: "Ligação", icon: Phone },
    { value: "email", label: "E-mail", icon: Mail },
    { value: "reuniao", label: "Reunião", icon: Calendar },
    { value: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  ];

  useEffect(() => {
    if (user) {
      loadInteractions();
      loadContacts();
    }
  }, [user]);

  const loadContacts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.id)
        .order('nome');

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
    }
  };

  const loadInteractions = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('interactions')
        .select(`
          *,
          contacts (
            nome,
            empresa,
            email
          )
        `)
        .eq('user_id', user.id)
        .order('data_interacao', { ascending: false });

      if (error) throw error;

      const formattedInteractions = data?.map(interaction => ({
        ...interaction,
        contact: interaction.contacts
      })) || [];

      setInteractions(formattedInteractions);
    } catch (error) {
      console.error('Erro ao carregar interações:', error);
      toast.error("Erro ao carregar interações");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const interactionData = {
        ...formData,
        user_id: user.id,
        data_interacao: formData.data_interacao || new Date().toISOString().split('T')[0]
      };

      if (editingInteraction) {
        const { error } = await supabase
          .from('interactions')
          .update(interactionData)
          .eq('id', editingInteraction.id);

        if (error) throw error;
        toast.success("Interação atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from('interactions')
          .insert([interactionData]);

        if (error) throw error;
        toast.success("Interação criada com sucesso!");
      }

      resetForm();
      loadInteractions();
      onStatsUpdate?.();
    } catch (error) {
      console.error('Erro ao salvar interação:', error);
      toast.error("Erro ao salvar interação");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta interação?')) return;

    try {
      const { error } = await supabase
        .from('interactions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success("Interação excluída com sucesso!");
      loadInteractions();
      onStatsUpdate?.();
    } catch (error) {
      console.error('Erro ao excluir interação:', error);
      toast.error("Erro ao excluir interação");
    }
  };

  const resetForm = () => {
    setFormData({
      contact_id: "",
      tipo: "",
      assunto: "",
      descricao: "",
      data_interacao: ""
    });
    setEditingInteraction(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (interaction: Interaction) => {
    setFormData({
      contact_id: interaction.contact_id,
      tipo: interaction.tipo,
      assunto: interaction.assunto,
      descricao: interaction.descricao,
      data_interacao: interaction.data_interacao
    });
    setEditingInteraction(interaction);
    setIsDialogOpen(true);
  };

  const getTypeIcon = (type: string) => {
    const typeData = interactionTypes.find(t => t.value === type);
    const IconComponent = typeData?.icon || MessageSquare;
    return <IconComponent className="h-4 w-4" />;
  };

  const filteredInteractions = interactions.filter(interaction => {
    const matchesSearch = !searchTerm || 
      interaction.assunto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      interaction.contact?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      interaction.contact?.empresa?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = filterType === "all" || interaction.tipo === filterType;

    return matchesSearch && matchesFilter;
  });
  
  const totalPages = Math.ceil(filteredInteractions.length / INTERACTIONS_PER_PAGE);
  const startIndex = (currentPage - 1) * INTERACTIONS_PER_PAGE;
  const endIndex = startIndex + INTERACTIONS_PER_PAGE;
  const paginatedInteractions = filteredInteractions.slice(startIndex, endIndex);
  
  // Gera números de página limitados
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7;
    
    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    
    pages.push(1);
    
    if (currentPage > 3) {
      pages.push('...');
    }
    
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    if (currentPage < totalPages - 2) {
      pages.push('...');
    }
    
    if (totalPages > 1) {
      pages.push(totalPages);
    }
    
    return pages;
  };
  
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType]);

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Gerenciar Interações
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingInteraction(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Interação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingInteraction ? "Editar Interação" : "Nova Interação"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact_id">Contato</Label>
                    <Select
                      value={formData.contact_id}
                      onValueChange={(value) => setFormData({...formData, contact_id: value})}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um contato" />
                      </SelectTrigger>
                      <SelectContent>
                        {contacts.map(contact => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.nome} - {contact.empresa}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tipo">Tipo de Interação</Label>
                    <Select
                      value={formData.tipo}
                      onValueChange={(value) => setFormData({...formData, tipo: value})}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {interactionTypes.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="assunto">Assunto</Label>
                    <Input
                      id="assunto"
                      value={formData.assunto}
                      onChange={(e) => setFormData({...formData, assunto: e.target.value})}
                      placeholder="Assunto da interação"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="data_interacao">Data da Interação</Label>
                    <Input
                      id="data_interacao"
                      type="date"
                      value={formData.data_interacao}
                      onChange={(e) => setFormData({...formData, data_interacao: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descricao">Descrição</Label>
                  <Textarea
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                    placeholder="Descreva os detalhes da interação..."
                    rows={4}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1">
                    {editingInteraction ? "Atualizar" : "Criar"} Interação
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por assunto, contato ou empresa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {interactionTypes.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Lista de Interações */}
        {loading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Carregando interações...</p>
          </div>
        ) : paginatedInteractions.length > 0 ? (
          <div className="space-y-4">
            {paginatedInteractions.map((interaction) => (
              <div key={interaction.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      {getTypeIcon(interaction.tipo)}
                    </div>
                    <div>
                      <h4 className="font-semibold">{interaction.assunto}</h4>
                      <p className="text-sm text-muted-foreground">
                        {interaction.contact?.nome} - {interaction.contact?.empresa}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {interactionTypes.find(t => t.value === interaction.tipo)?.label || interaction.tipo}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(interaction)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(interaction.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {interaction.descricao && (
                  <p className="text-sm text-muted-foreground mb-2">
                    {interaction.descricao}
                  </p>
                )}
                
                <p className="text-xs text-muted-foreground">
                  {format(new Date(interaction.data_interacao), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <MessageSquare className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhuma interação encontrada</p>
            <p className="text-sm text-muted-foreground">
              {searchTerm || filterType !== "all" 
                ? "Tente ajustar os filtros de busca" 
                : "Comece criando sua primeira interação"
              }
            </p>
          </div>
        )}
        
        {totalPages > 1 && (
          <div className="mt-6 flex justify-center">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                
                {getPageNumbers().map((page, idx) => (
                  <PaginationItem key={`page-${idx}`}>
                    {page === '...' ? (
                      <span className="px-4 py-2">...</span>
                    ) : (
                      <PaginationLink
                        onClick={() => setCurrentPage(page as number)}
                        isActive={currentPage === page}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}
                
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
        
        {filteredInteractions.length > 0 && (
          <div className="mt-4 text-sm text-muted-foreground text-center">
            Mostrando {startIndex + 1}-{Math.min(endIndex, filteredInteractions.length)} de {filteredInteractions.length} interações
            {filteredInteractions.length !== interactions.length && ` (${interactions.length} no total)`}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InteractionsManager;