import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Megaphone, TrendingUp, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Metrics {
  leadsAtivos: number;
  campanhasAtivas: number;
  conversoes: number;
  aberturasContas: number;
}

export function MetricsCards() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<Metrics>({
    leadsAtivos: 0,
    campanhasAtivas: 0,
    conversoes: 0,
    aberturasContas: 0
  });

  useEffect(() => {
    loadMetrics();
  }, [user]);

  const loadMetrics = async () => {
    if (!user) return;

    try {
      // Leads Ativos
      const { count: leadsCount } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("status", ["novo", "qualificado"]);

      // Campanhas Ativas
      const { count: campaignsCount } = await supabase
        .from("campaigns")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "ativa");

      // Conversões CRM (oportunidades fechadas)
      const { count: conversionsCount } = await supabase
        .from("opportunities")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "fechada");

      // Propostas Enviadas (oportunidades ativas)
      const { count: proposalsCount } = await supabase
        .from("opportunities")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "aberta");

      setMetrics({
        leadsAtivos: leadsCount || 0,
        campanhasAtivas: campaignsCount || 0,
        conversoes: conversionsCount || 0,
        aberturasContas: proposalsCount || 0
      });
    } catch (error) {
      console.error("Erro ao carregar métricas:", error);
    }
  };

  const cards = [
    {
      title: "Leads Ativos",
      value: metrics.leadsAtivos,
      icon: Users,
      color: "text-blue-500"
    },
    {
      title: "Campanhas em Execução",
      value: metrics.campanhasAtivas,
      icon: Megaphone,
      color: "text-purple-500"
    },
    {
      title: "Conversões CRM",
      value: metrics.conversoes,
      icon: TrendingUp,
      color: "text-green-500"
    },
    {
      title: "Propostas Única Disparos",
      value: metrics.aberturasContas,
      icon: Building2,
      color: "text-orange-500"
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {card.title}
            </CardTitle>
            <card.icon className={`h-4 w-4 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
