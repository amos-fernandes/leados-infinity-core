import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Brain, 
  DollarSign, 
  Crown, 
  AlertTriangle, 
  Clock,
  Target,
  MessageSquare,
  ChevronRight
} from "lucide-react";

interface BANTScore {
  score: number;
  analysis: string;
}

interface BANT {
  budget: BANTScore;
  authority: BANTScore;
  need: BANTScore;
  timeline: BANTScore;
}

interface LeadQualificationViewProps {
  lead: {
    id: string;
    empresa?: string;
    qualification_score?: string;
    qualification_level?: string;
    approach_strategy?: string;
    estimated_revenue?: string;
    recommended_channel?: string;
    bant_analysis?: string;
    next_steps?: string;
  };
}

const LeadQualificationView = ({ lead }: LeadQualificationViewProps) => {
  if (!lead.qualification_score || !lead.bant_analysis) {
    return null;
  }

  let bant: BANT;
  let nextSteps: string[] = [];

  try {
    bant = JSON.parse(lead.bant_analysis);
    if (lead.next_steps) {
      nextSteps = JSON.parse(lead.next_steps);
    }
  } catch (error) {
    console.error('Erro ao parsear dados de qualificação:', error);
    return null;
  }

  const overallScore = parseFloat(lead.qualification_score);
  
  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-600";
    if (score >= 6) return "text-yellow-600";
    return "text-red-600";
  };

  const getLevelColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'alta': return "bg-green-100 text-green-800";
      case 'média': return "bg-yellow-100 text-yellow-800";
      case 'baixa': return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          Qualificação IA - {lead.empresa || 'Lead'}
          <Badge className={getLevelColor(lead.qualification_level || '')}>
            {lead.qualification_level} ({overallScore}/10)
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Análise BANT */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="font-medium">Budget</span>
              <span className={`font-bold ${getScoreColor(bant.budget.score)}`}>
                {bant.budget.score}/10
              </span>
            </div>
            <Progress value={bant.budget.score * 10} className="h-2" />
            <p className="text-sm text-muted-foreground">{bant.budget.analysis}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-purple-600" />
              <span className="font-medium">Authority</span>
              <span className={`font-bold ${getScoreColor(bant.authority.score)}`}>
                {bant.authority.score}/10
              </span>
            </div>
            <Progress value={bant.authority.score * 10} className="h-2" />
            <p className="text-sm text-muted-foreground">{bant.authority.analysis}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <span className="font-medium">Need</span>
              <span className={`font-bold ${getScoreColor(bant.need.score)}`}>
                {bant.need.score}/10
              </span>
            </div>
            <Progress value={bant.need.score * 10} className="h-2" />
            <p className="text-sm text-muted-foreground">{bant.need.analysis}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="font-medium">Timeline</span>
              <span className={`font-bold ${getScoreColor(bant.timeline.score)}`}>
                {bant.timeline.score}/10
              </span>
            </div>
            <Progress value={bant.timeline.score * 10} className="h-2" />
            <p className="text-sm text-muted-foreground">{bant.timeline.analysis}</p>
          </div>
        </div>

        {/* Estratégia de Abordagem */}
        {lead.approach_strategy && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="font-medium">Estratégia de Abordagem</span>
            </div>
            <p className="text-sm bg-primary/5 p-3 rounded-lg">{lead.approach_strategy}</p>
          </div>
        )}

        {/* Canal Recomendado e Receita Estimada */}
        <div className="grid grid-cols-2 gap-4">
          {lead.recommended_channel && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-600" />
                <span className="font-medium">Canal Recomendado</span>
              </div>
              <Badge variant="outline" className="text-sm">
                {lead.recommended_channel}
              </Badge>
            </div>
          )}

          {lead.estimated_revenue && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="font-medium">Receita Estimada</span>
              </div>
              <Badge className="bg-green-100 text-green-800">
                {lead.estimated_revenue}
              </Badge>
            </div>
          )}
        </div>

        {/* Próximos Passos */}
        {nextSteps.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ChevronRight className="h-4 w-4 text-primary" />
              <span className="font-medium">Próximos Passos</span>
            </div>
            <ul className="space-y-1">
              {nextSteps.map((step, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="flex-shrink-0 w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center text-xs font-medium text-primary">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LeadQualificationView;