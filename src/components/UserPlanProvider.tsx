import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface UserPlan {
  plan: 'gratuito' | 'pro' | 'enterprise';
  leadsUsed: number;
  leadsLimit: number; 
  trialDaysLeft?: number;
  trialEndDate?: Date;
  isTrialActive: boolean;
  planStartDate: Date;
  canExportToCRM: boolean;
  canUseWhatsApp: boolean;
  canUseEnrichedData: boolean;
}

interface UserPlanContextType extends UserPlan {
  updateLeadsUsed: (count: number) => void;
  upgradePlan: (newPlan: 'pro' | 'enterprise') => Promise<void>;
  resetMonthlyUsage: () => void;
}

const UserPlanContext = createContext<UserPlanContextType | undefined>(undefined);

export const useUserPlan = () => {
  const context = useContext(UserPlanContext);
  if (!context) {
    throw new Error('useUserPlan must be used within a UserPlanProvider');
  }
  return context;
};

// Default plan configuration  
const planConfigs = {
  gratuito: {
    leadsLimit: 10,
    canExportToCRM: false,
    canUseWhatsApp: false,
    canUseEnrichedData: false,
  },
  pro: {
    leadsLimit: 500,
    canExportToCRM: true,
    canUseWhatsApp: true,
    canUseEnrichedData: true,
  },
  enterprise: {
    leadsLimit: 2000,
    canExportToCRM: true,
    canUseWhatsApp: true,
    canUseEnrichedData: true,
  }
};

interface UserPlanProviderProps {
  children: ReactNode;
}

export const UserPlanProvider = ({ children }: UserPlanProviderProps) => {
  const { user } = useAuth();
  const [userPlan, setUserPlan] = useState<UserPlan>({
    plan: 'gratuito',
    leadsUsed: 0,
    leadsLimit: 10,
    trialDaysLeft: undefined,
    trialEndDate: undefined,
    isTrialActive: false,
    planStartDate: new Date(),
    canExportToCRM: false,
    canUseWhatsApp: false,
    canUseEnrichedData: false,
  });

  // Load user plan data
  useEffect(() => {
    const loadUserPlan = async () => {
      if (!user) return;

      try {
        // Verificar se existe perfil do usuário
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        // Buscar dados de uso de leads (simulação usando interactions como proxy)
        const { data: interactions } = await supabase
          .from('interactions')
          .select('*')
          .eq('user_id', user.id);

        // Calcular leads usados neste mês
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        const leadsUsedThisMonth = interactions?.filter(interaction => {
          const interactionDate = new Date(interaction.created_at);
          return interactionDate.getMonth() === currentMonth && 
                 interactionDate.getFullYear() === currentYear;
        }).length || 0;

        // Determinar plano do usuário (por enquanto todos começam no gratuito)
        const userPlanType = (profile?.role === 'admin' ? 'enterprise' : 'gratuito') as 'gratuito' | 'pro' | 'enterprise';
        const config = planConfigs[userPlanType];

        // Calcular dados de trial (simulação - 7 dias a partir do cadastro)
        const accountCreated = new Date(user.created_at);
        const trialEndDate = new Date(accountCreated);
        trialEndDate.setDate(trialEndDate.getDate() + 7);
        
        const now = new Date();
        const isTrialActive = now < trialEndDate && userPlanType === 'pro';
        const trialDaysLeft = isTrialActive ? 
          Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 
          undefined;

        setUserPlan({
          plan: userPlanType,
          leadsUsed: leadsUsedThisMonth,
          leadsLimit: config.leadsLimit,
          trialDaysLeft,
          trialEndDate: isTrialActive ? trialEndDate : undefined,
          isTrialActive,
          planStartDate: accountCreated,
          canExportToCRM: config.canExportToCRM,
          canUseWhatsApp: config.canUseWhatsApp,
          canUseEnrichedData: config.canUseEnrichedData,
        });

      } catch (error) {
        console.error('Erro ao carregar dados do plano:', error);
      }
    };

    loadUserPlan();
  }, [user]);

  const updateLeadsUsed = (count: number) => {
    setUserPlan(prev => ({
      ...prev,
      leadsUsed: prev.leadsUsed + count
    }));
  };

  const upgradePlan = async (newPlan: 'pro' | 'enterprise') => {
    if (!user) return;

    try {
      // Aqui seria integrado com sistema de pagamento
      // Por enquanto, apenas simula o upgrade
      const config = planConfigs[newPlan];
      
      setUserPlan(prev => ({
        ...prev,
        plan: newPlan,
        leadsLimit: config.leadsLimit,
        canExportToCRM: config.canExportToCRM,
        canUseWhatsApp: config.canUseWhatsApp,
        canUseEnrichedData: config.canUseEnrichedData,
        isTrialActive: newPlan === 'pro' ? true : false,
        trialDaysLeft: newPlan === 'pro' ? 7 : undefined,
      }));

      // Atualizar perfil do usuário
      await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          role: newPlan === 'enterprise' ? 'admin' : 'sdr',
          display_name: user.email?.split('@')[0],
        });

    } catch (error) {
      console.error('Erro ao fazer upgrade:', error);
      throw error;
    }
  };

  const resetMonthlyUsage = () => {
    setUserPlan(prev => ({
      ...prev,
      leadsUsed: 0
    }));
  };

  const contextValue: UserPlanContextType = {
    ...userPlan,
    updateLeadsUsed,
    upgradePlan,
    resetMonthlyUsage,
  };

  return (
    <UserPlanContext.Provider value={contextValue}>
      {children}
    </UserPlanContext.Provider>
  );
};