import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Search, 
  MessageCircle, 
  Target, 
  BarChart3,
  CheckCircle,
  AlertCircle,
  Clock
} from "lucide-react";

interface CampaignPhase {
  phase: number;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  details: any;
}

interface CampaignPhaseTrackerProps {
  phases: CampaignPhase[];
  className?: string;
}

const CampaignPhaseTracker: React.FC<CampaignPhaseTrackerProps> = ({ phases, className }) => {
  const phaseIcons = {
    1: Search,
    2: MessageCircle,
    3: Target,
    4: BarChart3
  };

  const statusIcons = {
    pending: Clock,
    processing: Clock,
    completed: CheckCircle,
    failed: AlertCircle
  };

  const statusColors = {
    pending: 'bg-gray-100 text-gray-600',
    processing: 'bg-blue-100 text-blue-600',
    completed: 'bg-green-100 text-green-600',
    failed: 'bg-red-100 text-red-600'
  };

  const completedPhases = phases.filter(p => p.status === 'completed').length;
  const totalPhases = phases.length;
  const progressPercent = (completedPhases / totalPhases) * 100;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Fluxo de Campanha Automatizada</span>
          <Badge variant="outline">
            {completedPhases}/{totalPhases} Fases
          </Badge>
        </CardTitle>
        <Progress value={progressPercent} className="w-full" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {phases.map((phase) => {
            const PhaseIcon = phaseIcons[phase.phase as keyof typeof phaseIcons];
            const StatusIcon = statusIcons[phase.status];
            
            return (
              <div key={phase.phase} className="flex items-start space-x-3 p-3 rounded-lg border">
                <div className="flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${statusColors[phase.status]}`}>
                    {PhaseIcon && <PhaseIcon className="w-4 h-4" />}
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-900">
                      Fase {phase.phase}: {phase.name}
                    </h4>
                    <div className="flex items-center space-x-1">
                      <StatusIcon className="w-4 h-4" />
                      <Badge 
                        variant={phase.status === 'completed' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {phase.status === 'completed' ? 'Concluída' :
                         phase.status === 'processing' ? 'Processando' :
                         phase.status === 'failed' ? 'Falhou' : 'Pendente'}
                      </Badge>
                    </div>
                  </div>
                  
                  {phase.details && (
                    <div className="mt-2 text-xs text-gray-600">
                      {phase.phase === 1 && phase.status === 'completed' && (
                        <p>✅ {phase.details.qualifiedLeads} leads qualificados | {phase.details.prospectsGenerated} prospects gerados</p>
                      )}
                      {phase.phase === 2 && phase.status === 'completed' && (
                        <p>📞 {phase.details.totalChannelsUsed} canais usados | Prioridade: {phase.details.priority}</p>
                      )}
                      {phase.phase === 3 && phase.status === 'completed' && (
                        <p>🎯 {phase.details.leadsQualified} leads qualificados | Score médio: {Math.round(phase.details.averageScore)}%</p>
                      )}
                      {phase.phase === 4 && phase.status === 'completed' && (
                        <p>📊 {phase.details.followUpsScheduled} follow-ups agendados | Tracking: {phase.details.trackingPeriod}</p>
                      )}
                      {phase.status === 'failed' && (
                        <p className="text-red-600">❌ {phase.details.error}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {totalPhases > 0 && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <h5 className="text-sm font-medium text-blue-900 mb-2">Resumo do Fluxo:</h5>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>🔍 <strong>Fase 1:</strong> Identificação IA com exclusão MEI/terceiro setor</li>
              <li>📞 <strong>Fase 2:</strong> WhatsApp (foco) + E-mail (reforço) + Ligação (apoio)</li>
              <li>🎯 <strong>Fase 3:</strong> Qualificação C6 Bank com proposta imediata</li>
              <li>📊 <strong>Fase 4:</strong> CRM integrado + Follow-ups + Tracking conversões</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CampaignPhaseTracker;