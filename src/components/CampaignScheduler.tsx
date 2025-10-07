import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Calendar as CalendarIcon, Clock, Send } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export function CampaignScheduler({ userId }: { userId: string }) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isScheduling, setIsScheduling] = useState(false);

  // Buscar estatísticas de agendamento
  const { data: stats, refetch } = useQuery({
    queryKey: ['scheduler-stats', userId, selectedDate],
    queryFn: async () => {
      const dayStart = new Date(selectedDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(selectedDate);
      dayEnd.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('scheduled_messages')
        .select('status, scheduled_time')
        .eq('user_id', userId)
        .gte('scheduled_time', dayStart.toISOString())
        .lte('scheduled_time', dayEnd.toISOString());

      if (error) throw error;

      const scheduled = data?.filter(m => m.status === 'scheduled').length || 0;
      const sent = data?.filter(m => m.status === 'sent').length || 0;
      const failed = data?.filter(m => m.status === 'failed').length || 0;

      return { total: data?.length || 0, scheduled, sent, failed };
    }
  });

  const handleSchedule = async () => {
    setIsScheduling(true);

    try {
      const { data, error } = await supabase.functions.invoke('message-scheduler', {
        body: {
          userId,
          action: 'schedule',
          targetDate: selectedDate.toISOString()
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`🎉 Agendamento criado!`, {
          description: `${data.data.scheduled} mensagens agendadas para ${new Date(data.data.schedule_date).toLocaleDateString('pt-BR')}`
        });
        refetch();
      } else {
        throw new Error(data.error);
      }

    } catch (error) {
      console.error('Erro ao agendar:', error);
      toast.error('Erro ao criar agendamento', {
        description: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Sistema de Agendamento Inteligente
          </CardTitle>
          <CardDescription>
            Agende até 1000 disparos/dia com distribuição randômica e heterogênea
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Calendário */}
            <div className="space-y-4">
              <div className="rounded-lg border p-4">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  className="rounded-md"
                />
              </div>
              
              <Button 
                onClick={handleSchedule} 
                disabled={isScheduling}
                className="w-full"
                size="lg"
              >
                <Send className="h-4 w-4 mr-2" />
                {isScheduling ? 'Agendando...' : 'Criar Agendamento'}
              </Button>
            </div>

            {/* Estatísticas */}
            <div className="space-y-4">
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Estatísticas - {selectedDate.toLocaleDateString('pt-BR')}
                </h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-blue-600">
                        {stats?.scheduled || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">Agendados</div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-green-600">
                        {stats?.sent || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">Enviados</div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-red-600">
                        {stats?.failed || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">Falhas</div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold">
                        {stats?.total || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">Total</div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200">
                <CardContent className="p-4 space-y-2">
                  <h4 className="font-semibold text-sm">Como Funciona</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>✓ 1000 disparos distribuídos em 24 horas</li>
                    <li>✓ Horários randomizados para evitar padrões</li>
                    <li>✓ Espaçamento mínimo de 60 segundos</li>
                    <li>✓ Retentativa automática em caso de falha</li>
                    <li>✓ Execução via cron job a cada minuto</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Informações sobre Cron Job */}
          <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200">
            <CardContent className="p-4 space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                ⚙️ Configuração do Cron Job
              </h4>
              <p className="text-sm text-muted-foreground">
                Para ativar o disparo automático, configure um cron job no Supabase:
              </p>
              <pre className="bg-background p-3 rounded text-xs overflow-x-auto">
{`SELECT cron.schedule(
  'dispatch-messages-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://rcfmbjkolnzjhrlgrtda.supabase.co/functions/v1/message-dispatcher',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_KEY"}'::jsonb
  ) as request_id;
  $$
);`}
              </pre>
              <p className="text-xs text-muted-foreground">
                ⚠️ Execute este SQL no seu projeto Supabase para ativar o dispatcher automático
              </p>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}