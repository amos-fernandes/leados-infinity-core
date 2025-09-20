import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MessageCircle, Users, Activity, Bot, TrendingUp, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import WhatsAppConfig from "./WhatsAppConfig";
import WhatsAppSetupGuide from "./WhatsAppSetupGuide";
import RAGChat from "./RAGChat";

interface WhatsAppDashboardProps {
  onGoBack: () => void;
}

const WhatsAppDashboard = ({ onGoBack }: WhatsAppDashboardProps) => {
  const { user } = useAuth();
  const [whatsappStats, setWhatsappStats] = useState({
    totalMessages: 0,
    totalInteractions: 0,
    leadsCreated: 0,
    botResponses: 0
  });
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadWhatsAppStats();
    }
  }, [user]);

  const loadWhatsAppStats = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Buscar mensagens do WhatsApp
      const { data: messages } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('user_id', user.id);

      // Buscar configuração do WhatsApp
      const { data: config } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('user_id', user.id)
        .limit(1);

      const totalMessages = messages?.length || 0;
      const botResponses = messages?.filter((m: any) => m.response_sent)?.length || 0;
      const leadsCreated = Math.floor(totalMessages * 0.3); // Simulação baseada nas mensagens
      
      setWhatsappStats({
        totalMessages,
        totalInteractions: totalMessages,
        leadsCreated,
        botResponses
      });

      setIsConnected(config && config.length > 0 ? config[0]?.is_active || false : false);

    } catch (error) {
      console.error('Erro ao carregar estatísticas do WhatsApp:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatsCard = ({ title, value, IconComponent, trend, trendUp, gradient }: {
    title: string;
    value: string;
    IconComponent: any;
    trend: string;
    trendUp: boolean;
    gradient?: boolean;
  }) => (
    <Card className={`shadow-soft ${gradient ? 'bg-gradient-primary text-white' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <IconComponent className={`h-4 w-4 ${gradient ? 'text-white' : 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className={`text-xs ${gradient ? 'text-white/80' : 'text-muted-foreground'} flex items-center gap-1`}>
          <TrendingUp className={`h-3 w-3 ${trendUp ? 'rotate-0' : 'rotate-180'}`} />
          {trend} em relação ao mês anterior
        </p>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header com botão voltar */}
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={onGoBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold">WhatsApp Business Dashboard</h1>
            <p className="text-muted-foreground">
              Central de atendimento e IA integrada
            </p>
          </div>
          <div className="ml-auto">
            <Badge variant={isConnected ? "default" : "secondary"} className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
              {isConnected ? "Conectado" : "Desconectado"}
            </Badge>
          </div>
        </div>

        {/* Status do WhatsApp Business */}
        <Card className="shadow-soft mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-500" />
              WhatsApp Business - Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <p className="font-medium">{isConnected ? "Conectado" : "Desconectado"}</p>
                <p className="text-sm text-muted-foreground">Status da API</p>
              </div>
              <div className="text-center">
                <div className="w-4 h-4 rounded-full bg-blue-500 mx-auto mb-2" />
                <p className="font-medium">Bot Ativo</p>
                <p className="text-sm text-muted-foreground">Respostas automáticas</p>
              </div>
              <div className="text-center">
                <div className="w-4 h-4 rounded-full bg-green-500 mx-auto mb-2" />
                <p className="font-medium">IA Integrada</p>
                <p className="text-sm text-muted-foreground">RAG Assistant</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard 
            title="Mensagens" 
            value={loading ? "..." : whatsappStats.totalMessages.toString()} 
            IconComponent={MessageCircle} 
            trend="+12%" 
            trendUp={true} 
          />
          <StatsCard 
            title="Interações" 
            value={loading ? "..." : whatsappStats.totalInteractions.toString()} 
            IconComponent={Users} 
            trend="+8%" 
            trendUp={true} 
            gradient={true}
          />
          <StatsCard 
            title="Leads Criados" 
            value={loading ? "..." : whatsappStats.leadsCreated.toString()} 
            IconComponent={Target} 
            trend="+25%" 
            trendUp={true} 
          />
          <StatsCard 
            title="Respostas IA" 
            value={loading ? "..." : whatsappStats.botResponses.toString()} 
            IconComponent={Bot} 
            trend="+18%" 
            trendUp={true} 
          />
        </div>

        {/* WhatsApp Configuration Section */}
        <WhatsAppSetupGuide />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <WhatsAppConfig />
          
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                Status WhatsApp Bot
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span className="text-sm font-medium">Configuração necessária</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Mensagens enviadas hoje</span>
                  <span className="text-sm font-medium">0</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Webhook</span>
                  <span className="text-sm font-medium text-orange-600">Não configurado</span>
                </div>
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={() => window.dispatchEvent(new CustomEvent('openWhatsAppBot'))}
                >
                  <Bot className="h-4 w-4 mr-2" />
                  Gerenciar Bot WhatsApp
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* WhatsApp Bot - Conversa */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-green-500" />
                WhatsApp Bot - Conversa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <MessageCircle className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">WhatsApp Bot Ativo</p>
                <p className="text-muted-foreground mb-4">
                  Bot está configurado e respondendo mensagens automaticamente via IA
                </p>
                <div className="grid grid-cols-3 gap-4 mt-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{whatsappStats.totalMessages}</p>
                    <p className="text-sm text-muted-foreground">Mensagens</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{whatsappStats.botResponses}</p>
                    <p className="text-sm text-muted-foreground">Respostas IA</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-600">{whatsappStats.leadsCreated}</p>
                    <p className="text-sm text-muted-foreground">Leads</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bot WhatsApp Única Contábil - RAG Assistant IA */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-accent" />
                Bot WhatsApp Única Contábil
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RAGChat />
            </CardContent>
          </Card>
        </div>

        {/* Atividades em Tempo Real */}
        <Card className="shadow-soft mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Atividades em Tempo Real
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Lista de atividades em tempo real */}
              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-full bg-green-100">
                  <MessageCircle className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Nova mensagem recebida</p>
                  <p className="text-sm text-muted-foreground">Cliente José Silva - +55 62 9999-8888</p>
                </div>
                <span className="text-xs text-muted-foreground">agora</span>
              </div>
              
              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-full bg-blue-100">
                  <Bot className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Bot respondeu automaticamente</p>
                  <p className="text-sm text-muted-foreground">Resposta gerada pela IA para Maria Santos</p>
                </div>
                <span className="text-xs text-muted-foreground">2 min</span>
              </div>

              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-full bg-orange-100">
                  <Target className="h-4 w-4 text-orange-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Novo lead qualificado</p>
                  <p className="text-sm text-muted-foreground">Lead criado via WhatsApp - Empresa ABC Ltda</p>
                </div>
                <span className="text-xs text-muted-foreground">5 min</span>
              </div>

              <div className="text-center py-4">
                <Button variant="outline" onClick={loadWhatsAppStats}>
                  <Activity className="h-4 w-4 mr-2" />
                  Atualizar Atividades
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WhatsAppDashboard;