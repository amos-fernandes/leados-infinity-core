import { useState, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Building2, 
  Phone, 
  Mail, 
  Globe, 
  GripVertical,
  Star,
  TrendingUp,
  Users,
  DollarSign,
  Sparkles,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Lead {
  id: string;
  empresa: string;
  setor?: string;
  telefone?: string;
  email?: string;
  website?: string;
  status: string;
  qualification_score?: string;
  qualification_level?: string;
  gancho_prospeccao?: string;
  created_at: string;
}

interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  bgColor: string;
  leads: Lead[];
}

interface KanbanBoardProps {
  onStatsUpdate?: () => void;
}

const COLUMNS: Omit<KanbanColumn, 'leads'>[] = [
  { id: 'novo', title: 'Novos', color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/30' },
  { id: 'em_contato', title: 'Em Contato', color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-950/30' },
  { id: 'qualificado', title: 'Qualificados', color: 'text-emerald-600', bgColor: 'bg-emerald-50 dark:bg-emerald-950/30' },
  { id: 'proposta', title: 'Proposta', color: 'text-purple-600', bgColor: 'bg-purple-50 dark:bg-purple-950/30' },
  { id: 'convertido', title: 'Convertidos', color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-950/30' },
  { id: 'perdido', title: 'Perdidos', color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-950/30' },
];

// Sortable Lead Card Component
const SortableLeadCard = ({ lead, isDragging }: { lead: Lead; isDragging?: boolean }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getScoreColor = (level?: string) => {
    switch (level) {
      case 'high': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'medium': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'low': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-card border rounded-lg p-3 mb-2 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-all",
        isDragging && "opacity-50 scale-105 shadow-lg"
      )}
    >
      <div className="flex items-start gap-2">
        <div
          {...attributes}
          {...listeners}
          className="mt-1 text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4 className="font-medium text-sm truncate">{lead.empresa}</h4>
            {lead.qualification_level && (
              <Badge variant="secondary" className={cn("text-xs shrink-0", getScoreColor(lead.qualification_level))}>
                {lead.qualification_score || '?'}
              </Badge>
            )}
          </div>
          
          {lead.setor && (
            <p className="text-xs text-muted-foreground mb-2 truncate">{lead.setor}</p>
          )}
          
          <div className="flex flex-wrap gap-1">
            {lead.telefone && (
              <Badge variant="outline" className="text-xs gap-1 py-0">
                <Phone className="h-3 w-3" />
              </Badge>
            )}
            {lead.email && (
              <Badge variant="outline" className="text-xs gap-1 py-0">
                <Mail className="h-3 w-3" />
              </Badge>
            )}
            {lead.website && (
              <Badge variant="outline" className="text-xs gap-1 py-0">
                <Globe className="h-3 w-3" />
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Column Component
const KanbanColumnComponent = ({ column }: { column: KanbanColumn }) => {
  return (
    <div className={cn("flex flex-col rounded-lg p-3 min-h-[500px]", column.bgColor)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={cn("font-semibold text-sm", column.color)}>{column.title}</h3>
        <Badge variant="secondary" className="text-xs">
          {column.leads.length}
        </Badge>
      </div>
      
      <ScrollArea className="flex-1">
        <SortableContext items={column.leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 pr-2">
            {column.leads.map((lead) => (
              <SortableLeadCard key={lead.id} lead={lead} />
            ))}
            {column.leads.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-8">
                Nenhum lead
              </div>
            )}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
};

export const KanbanBoard = ({ onStatsUpdate }: KanbanBoardProps) => {
  const { user } = useAuth();
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const loadLeads = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const leads = data || [];
      
      // Organize leads into columns
      const newColumns: KanbanColumn[] = COLUMNS.map(col => ({
        ...col,
        leads: leads.filter(lead => lead.status === col.id)
      }));

      setColumns(newColumns);
    } catch (error) {
      console.error('Erro ao carregar leads:', error);
      toast.error('Erro ao carregar leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, [user]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    
    // Find the lead being dragged
    for (const col of columns) {
      const lead = col.leads.find(l => l.id === active.id);
      if (lead) {
        setActiveLead(lead);
        break;
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveLead(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find source column and lead
    let sourceColumn: KanbanColumn | undefined;
    let movedLead: Lead | undefined;
    
    for (const col of columns) {
      const lead = col.leads.find(l => l.id === activeId);
      if (lead) {
        sourceColumn = col;
        movedLead = lead;
        break;
      }
    }

    if (!sourceColumn || !movedLead) return;

    // Determine target column
    let targetColumnId = overId;
    
    // Check if overId is a lead id (dropped on another card)
    for (const col of columns) {
      if (col.leads.some(l => l.id === overId)) {
        targetColumnId = col.id;
        break;
      }
    }
    
    // Check if overId is a column id
    if (!COLUMNS.some(c => c.id === targetColumnId)) {
      targetColumnId = sourceColumn.id;
    }

    if (sourceColumn.id === targetColumnId) return;

    // Update local state optimistically
    setColumns(prev => {
      const newColumns = prev.map(col => {
        if (col.id === sourceColumn!.id) {
          return { ...col, leads: col.leads.filter(l => l.id !== activeId) };
        }
        if (col.id === targetColumnId) {
          return { ...col, leads: [{ ...movedLead!, status: targetColumnId }, ...col.leads] };
        }
        return col;
      });
      return newColumns;
    });

    // Update database
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: targetColumnId })
        .eq('id', activeId)
        .eq('user_id', user?.id);

      if (error) throw error;
      
      toast.success(`Lead movido para ${COLUMNS.find(c => c.id === targetColumnId)?.title}`);
      onStatsUpdate?.();
    } catch (error) {
      console.error('Erro ao mover lead:', error);
      toast.error('Erro ao mover lead');
      // Revert on error
      loadLeads();
    }
  };

  // Calculate metrics
  const totalLeads = columns.reduce((sum, col) => sum + col.leads.length, 0);
  const qualifiedLeads = columns.find(c => c.id === 'qualificado')?.leads.length || 0;
  const convertedLeads = columns.find(c => c.id === 'convertido')?.leads.length || 0;
  const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : '0';

  return (
    <Card className="shadow-soft">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Pipeline de Vendas</CardTitle>
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" />
              Kanban
            </Badge>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="font-medium">{totalLeads}</span>
                <span className="text-muted-foreground">leads</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                <span className="font-medium">{qualifiedLeads}</span>
                <span className="text-muted-foreground">qualificados</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <span className="font-medium">{conversionRate}%</span>
                <span className="text-muted-foreground">conversão</span>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={loadLeads} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-6 gap-4">
            {columns.map((column) => (
              <KanbanColumnComponent key={column.id} column={column} />
            ))}
          </div>
          
          <DragOverlay>
            {activeLead ? (
              <div className="bg-card border rounded-lg p-3 shadow-lg cursor-grabbing">
                <h4 className="font-medium text-sm">{activeLead.empresa}</h4>
                {activeLead.setor && (
                  <p className="text-xs text-muted-foreground">{activeLead.setor}</p>
                )}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </CardContent>
    </Card>
  );
};

export default KanbanBoard;
