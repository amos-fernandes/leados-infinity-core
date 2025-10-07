-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Configurar cron job para dispatcher
SELECT cron.schedule(
  'dispatch-messages-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://rcfmbjkolnzjhrlgrtda.supabase.co/functions/v1/message-dispatcher',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.MY_SERVICE_KEY') || '"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);