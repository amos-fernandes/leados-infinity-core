import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  X,
  Crown,
  Check,
  ArrowRight,
  Zap,
  Users,
  Database,
  MessageSquare,
  TrendingUp
} from "lucide-react";
import { useUserPlan } from "./UserPlanProvider";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: 'gratuito' | 'pro' | 'enterprise';
}

const UpgradeModal = ({ isOpen, onClose, currentPlan }: UpgradeModalProps) => {
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'enterprise'>('pro');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [isUpgrading, setIsUpgrading] = useState(false);
  const { upgradePlan } = useUserPlan();

  if (!isOpen) return null;

  const plans = [
    {
      id: 'pro' as const,
      name: 'Pro',
      price: { monthly: 97, yearly: 87 },
      popular: true,
      description: 'Ideal para equipes de vendas focadas em resultados',
      features: [
        '500 leads por mês',
        'Dados completos de CNPJ + receita',
        'Exportação para CRM',
        'Integração WhatsApp/Email',
        'Análise de tecnologias',
        'Qualificação automática',
        'Suporte prioritário',
      ],
      icon: TrendingUp,
      gradient: 'from-primary to-primary-glow'
    },
    {
      id: 'enterprise' as const,
      name: 'Enterprise',
      price: { monthly: 297, yearly: 267 },
      popular: false,
      description: 'Para grandes equipes e agências',
      features: [
        '2000 leads por mês',
        'API dedicada',
        'Múltiplos usuários',
        'Relatórios avançados',
        'Integrações personalizadas',
        'Account manager dedicado',
        'SLA garantido',
        'Onboarding premium'
      ],
      icon: Crown,
      gradient: 'from-secondary to-accent'
    }
  ];

  const handleUpgrade = async () => {
    if (isUpgrading) return;
    
    setIsUpgrading(true);
    try {
      await upgradePlan(selectedPlan);
      onClose();
      
      // Mostrar mensagem de sucesso
      // Em produção, aqui redirecionaria para o checkout
      alert(`Upgrade para ${selectedPlan.toUpperCase()} realizado com sucesso! Em produção, você seria redirecionado para o checkout.`);
      
    } catch (error) {
      console.error('Erro no upgrade:', error);
      alert('Erro ao processar upgrade. Tente novamente.');
    } finally {
      setIsUpgrading(false);
    }
  };

  const getCurrentPlanFeatures = () => {
    switch (currentPlan) {
      case 'gratuito':
        return [
          '10 leads por mês',
          'Dados básicos de CNPJ',
          'Pesquisa por setor',
          'Suporte por email'
        ];
      case 'pro':
        return plans[0].features;
      case 'enterprise':
        return plans[1].features;
      default:
        return [];
    }
  };

  const getUpgradeReasons = () => {
    if (currentPlan === 'gratuito') {
      return [
        { icon: Database, text: 'Acesse dados enriquecidos de CNPJ e receita' },
        { icon: MessageSquare, text: 'Integre com WhatsApp e Email' },
        { icon: Users, text: 'Exporte leads diretamente para seu CRM' },
        { icon: Zap, text: '50x mais leads por mês (500 vs 10)' }
      ];
    }
    
    if (currentPlan === 'pro') {
      return [
        { icon: Users, text: 'Múltiplos usuários na mesma conta' },
        { icon: Database, text: 'API dedicada para integrações' },
        { icon: TrendingUp, text: '4x mais leads por mês (2000 vs 500)' },
        { icon: Crown, text: 'Account manager dedicado' }
      ];
    }
    
    return [];
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold">Upgrade seu plano</h2>
            <p className="text-muted-foreground">
              Desbloqueie todo o potencial do Leados AI
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6">
          {/* Current Plan Info */}
          <Card className="mb-6 border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                    Plano Atual: {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
                  </h3>
                  <div className="text-sm text-amber-700 dark:text-amber-300 mt-2">
                    {getCurrentPlanFeatures().slice(0, 2).map((feature, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Check className="h-3 w-3" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                  Ativo
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Upgrade Reasons */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">Por que fazer upgrade?</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {getUpgradeReasons().map((reason, index) => (
                <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center">
                    <reason.icon className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-sm">{reason.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <span className={billingPeriod === 'monthly' ? 'font-semibold' : 'text-muted-foreground'}>
              Mensal
            </span>
            <button
              onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'yearly' : 'monthly')}
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary transition-colors"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  billingPeriod === 'yearly' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={billingPeriod === 'yearly' ? 'font-semibold' : 'text-muted-foreground'}>
              Anual
              <Badge className="ml-2 bg-accent/10 text-accent">-20%</Badge>
            </span>
          </div>

          {/* Plan Selection */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {plans.map((plan) => (
              <Card 
                key={plan.id}
                className={`cursor-pointer transition-all duration-200 ${
                  selectedPlan === plan.id 
                    ? 'border-primary shadow-lg scale-105' 
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => setSelectedPlan(plan.id)}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                    Mais Popular
                  </Badge>
                )}
                
                <CardContent className="p-6">
                  <div className="text-center mb-6">
                    <div className={`w-16 h-16 bg-gradient-to-r ${plan.gradient} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                      <plan.icon className="h-8 w-8 text-white" />
                    </div>
                    
                    <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                    
                    <div className="mb-4">
                      <span className="text-3xl font-bold">
                        R$ {plan.price[billingPeriod]}
                      </span>
                      <span className="text-muted-foreground">/mês</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {plan.features.map((feature, featureIndex) => (
                      <div key={featureIndex} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={onClose}
              disabled={isUpgrading}
            >
              Cancelar
            </Button>
            <Button 
              className="flex-1"
              onClick={handleUpgrade}
              disabled={isUpgrading}
            >
              {isUpgrading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Processando...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Upgrade para {selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>

          {/* Trial Info */}
          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              ✨ Teste gratuito de 7 dias • Cancele quando quiser
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;