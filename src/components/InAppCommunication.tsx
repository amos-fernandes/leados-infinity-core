import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  AlertTriangle, 
  Crown, 
  Zap, 
  Target,
  X,
  TrendingUp
} from "lucide-react";

interface InAppCommunicationProps {
  userPlan: string;
  leadsUsed: number;
  leadsLimit: number;
  trialDaysLeft?: number;
  onUpgrade?: () => void;
}

const InAppCommunication = ({ 
  userPlan, 
  leadsUsed, 
  leadsLimit, 
  trialDaysLeft, 
  onUpgrade 
}: InAppCommunicationProps) => {
  const [isDismissed, setIsDismissed] = useState(false);
  
  const usagePercentage = (leadsUsed / leadsLimit) * 100;
  const isNearLimit = usagePercentage >= 80;
  const isFreePlan = userPlan === 'free';
  const isTrialPlan = userPlan === 'trial';

  if (isDismissed) return null;

  return (
    <div className="space-y-4">
      {/* Trial Warning */}
      {isTrialPlan && trialDaysLeft !== undefined && trialDaysLeft <= 7 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Trial expirando em {trialDaysLeft} dias
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDismissed(true)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground mb-3">
              Seu período de teste termina em breve. Faça upgrade para continuar usando o LEADOS AI Pro.
            </p>
            <Button onClick={onUpgrade} className="w-full sm:w-auto">
              <Crown className="h-4 w-4 mr-2" />
              Fazer Upgrade Agora
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Usage Warning */}
      {isNearLimit && (
        <Card className="border-warning/50 bg-warning/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-5 w-5 text-warning" />
                Limite de leads próximo
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDismissed(true)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Leads utilizados</span>
                <span className="font-medium">{leadsUsed} / {leadsLimit}</span>
              </div>
              <Progress value={usagePercentage} className="h-2" />
              <p className="text-sm text-muted-foreground">
                Você usou {usagePercentage.toFixed(0)}% do seu limite mensal.
              </p>
              {isFreePlan && (
                <Button onClick={onUpgrade} className="w-full sm:w-auto">
                  <Zap className="h-4 w-4 mr-2" />
                  Upgrade para Mais Leads
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success/Growth Message */}
      {!isNearLimit && leadsUsed > 0 && (
        <Card className="border-success/50 bg-success/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-success" />
                Ótimo progresso!
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDismissed(true)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground mb-3">
              Você já gerou {leadsUsed} leads este mês. Continue assim para maximizar seus resultados!
            </p>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-success border-success/20">
                <Target className="h-3 w-3 mr-1" />
                {leadsUsed} leads gerados
              </Badge>
              <Badge variant="outline">
                Plano {userPlan.charAt(0).toUpperCase() + userPlan.slice(1)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default InAppCommunication;