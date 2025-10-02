-- Adicionar campos de validação Google Maps à tabela leads
ALTER TABLE public.leads 
ADD COLUMN google_maps_verified boolean DEFAULT false,
ADD COLUMN google_maps_rating decimal(2,1),
ADD COLUMN google_maps_reviews integer,
ADD COLUMN website_validated boolean DEFAULT false,
ADD COLUMN address_validated text,
ADD COLUMN business_type_confirmed text,
ADD COLUMN validation_completed_at timestamp with time zone;