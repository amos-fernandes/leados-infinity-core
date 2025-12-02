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

// Map app_role to plan type
const roleToPlan: Record<string, 'gratuito' | 'pro' | 'enterprise'> = {
  'free': 'gratuito',
  'sdr': 'pro',
  'pro': 'pro',
  'enterprise': 'enterprise',
  'admin': 'enterprise',
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

  // Load user plan data from user_roles table (secure)
  useEffect(() => {
    const loadUserPlan = async () => {
      if (!user) return;

      try {
        // Fetch user role from the secure user_roles table
        const { data: userRoles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        // Get the highest priority role
        let userRole = 'free';
        if (userRoles && userRoles.length > 0) {
          // Priority: admin > enterprise > pro > sdr > free
          const rolePriority = ['admin', 'enterprise', 'pro', 'sdr', 'free'];
          for (const priority of rolePriority) {
            if (userRoles.some(r => r.role === priority)) {
              userRole = priority;
              break;
            }
          }
        }

        // Fetch leads usage this month
        const { data: interactions } = await supabase
          .from('interactions')
          .select('*')
          .eq('user_id', user.id);

        // Calculate leads used this month
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        const leadsUsedThisMonth = interactions?.filter(interaction => {
          const interactionDate = new Date(interaction.created_at);
          return interactionDate.getMonth() === currentMonth && 
                 interactionDate.getFullYear() === currentYear;
        }).length || 0;

        // Map role to plan type
        const userPlanType = roleToPlan[userRole] || 'gratuito';
        const config = planConfigs[userPlanType];

        // Calculate trial data (7 days from signup)
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

  const resetMonthlyUsage = () => {
    setUserPlan(prev => ({
      ...prev,
      leadsUsed: 0
    }));
  };

  const contextValue: UserPlanContextType = {
    ...userPlan,
    updateLeadsUsed,
    resetMonthlyUsage,
  };

  return (
    <UserPlanContext.Provider value={contextValue}>
      {children}
    </UserPlanContext.Provider>
  );
};
