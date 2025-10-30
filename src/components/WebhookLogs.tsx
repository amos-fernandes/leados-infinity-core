import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

interface WebhookLog {
  id: string;
  event_type: string;
  processed: boolean;
  error_message: string | null;
  created_at: string;
  payload: any;
}

const WebhookLogs = () => {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadLogs();

    // Realtime updates
    const channel = supabase
      .channel('webhook_logs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'evolution_webhook_logs'
        },
        () => {
          loadLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('evolution_webhook_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error loading logs:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar logs',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getEventBadge = (eventType: string) => {
    const colors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'qrcode.updated': 'secondary',
      'connection.update': 'default',
      'messages.upsert': 'default',
      'messages.update': 'outline',
      'call.received': 'secondary'
    };

    return (
      <Badge variant={colors[eventType] || 'outline'}>
        {eventType}
      </Badge>
    );
  };

  if (loading) {
    return <div className="p-8">Carregando logs...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logs de Webhooks da Evolution API</CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Nenhum log encontrado
          </p>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex-shrink-0 mt-1">
                  {log.processed ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : log.error_message ? (
                    <XCircle className="w-5 h-5 text-red-500" />
                  ) : (
                    <Clock className="w-5 h-5 text-yellow-500" />
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    {getEventBadge(log.event_type)}
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')}
                    </span>
                  </div>

                  {log.error_message && (
                    <p className="text-sm text-red-500">
                      Erro: {log.error_message}
                    </p>
                  )}

                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      Ver payload
                    </summary>
                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-40">
                      {JSON.stringify(log.payload, null, 2)}
                    </pre>
                  </details>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WebhookLogs;
