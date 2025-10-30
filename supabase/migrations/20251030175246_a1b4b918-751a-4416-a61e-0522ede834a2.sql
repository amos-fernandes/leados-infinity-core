-- Corrigir função detect_temporal_anomaly adicionando search_path
CREATE OR REPLACE FUNCTION public.detect_temporal_anomaly(abertura_date DATE)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Retorna TRUE se a data de abertura é futura
  RETURN abertura_date > CURRENT_DATE;
END;
$$;