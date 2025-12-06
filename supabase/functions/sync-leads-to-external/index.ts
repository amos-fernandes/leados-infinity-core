import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function connectToExternalPostgres(): Promise<Client> {
  const connectionString = Deno.env.get('N8N_POSTGRES_URL');
  if (!connectionString) {
    throw new Error('N8N_POSTGRES_URL not configured');
  }

  const url = new URL(connectionString);
  const client = new Client({
    hostname: url.hostname,
    port: url.port || "5432",
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    tls: { enabled: false },
  });

  await client.connect();
  return client;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, fullSync = false, batchSize = 500 } = await req.json().catch(() => ({}));

    console.log(`Starting sync: userId=${userId}, fullSync=${fullSync}, batchSize=${batchSize}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Connect to external PostgreSQL
    const pgClient = await connectToExternalPostgres();
    console.log('Connected to external PostgreSQL');

    // Create leads table if not exists
    await pgClient.queryArray(`
      CREATE TABLE IF NOT EXISTS leads (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL,
        empresa TEXT NOT NULL,
        setor TEXT,
        cnpj TEXT,
        telefone TEXT,
        whatsapp TEXT,
        email TEXT,
        website TEXT,
        linkedin TEXT,
        cidade TEXT,
        uf TEXT,
        status TEXT DEFAULT 'novo',
        qualification_score TEXT,
        qualification_level TEXT,
        pontuacao_qualificacao INTEGER,
        gancho_prospeccao TEXT,
        contato_decisor TEXT,
        approach_strategy TEXT,
        capital_social NUMERIC,
        regime_tributario TEXT,
        cnae TEXT,
        cnae_principal TEXT,
        estimated_employees INTEGER,
        estimated_revenue TEXT,
        google_maps_verified BOOLEAN DEFAULT false,
        google_maps_rating NUMERIC,
        google_maps_reviews INTEGER,
        website_validated BOOLEAN DEFAULT false,
        bright_data_enriched BOOLEAN DEFAULT false,
        email_encontrado_automaticamente BOOLEAN DEFAULT false,
        tech_stack JSONB,
        social_media JSONB,
        bant_analysis JSONB,
        next_steps JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        qualified_at TIMESTAMPTZ,
        validation_completed_at TIMESTAMPTZ,
        data_qualificacao TIMESTAMPTZ,
        synced_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
      CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
      CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
      CREATE INDEX IF NOT EXISTS idx_leads_cnpj ON leads(cnpj);
    `);
    console.log('Ensured leads table exists in external DB');

    // Get last sync timestamp for incremental sync
    let lastSyncTime: string | null = null;
    if (!fullSync) {
      const lastSyncResult = await pgClient.queryObject<{ max_synced: string }>(
        `SELECT MAX(synced_at) as max_synced FROM leads WHERE user_id = $1`,
        [userId]
      );
      lastSyncTime = lastSyncResult.rows[0]?.max_synced || null;
    }

    // Build Supabase query
    let query = supabase.from('leads').select('*');
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    if (lastSyncTime && !fullSync) {
      query = query.gt('updated_at', lastSyncTime);
    }

    const { data: leads, error: fetchError } = await query.order('created_at', { ascending: true });

    if (fetchError) {
      throw new Error(`Failed to fetch leads: ${fetchError.message}`);
    }

    console.log(`Found ${leads?.length || 0} leads to sync`);

    let synced = 0;
    let errors = 0;

    if (leads && leads.length > 0) {
      // Process in batches
      for (let i = 0; i < leads.length; i += batchSize) {
        const batch = leads.slice(i, i + batchSize);
        
        for (const lead of batch) {
          try {
            await pgClient.queryArray(`
              INSERT INTO leads (
                id, user_id, empresa, setor, cnpj, telefone, whatsapp, email, website, linkedin,
                cidade, uf, status, qualification_score, qualification_level, pontuacao_qualificacao,
                gancho_prospeccao, contato_decisor, approach_strategy, capital_social, regime_tributario,
                cnae, cnae_principal, estimated_employees, estimated_revenue, google_maps_verified,
                google_maps_rating, google_maps_reviews, website_validated, bright_data_enriched,
                email_encontrado_automaticamente, tech_stack, social_media, bant_analysis, next_steps,
                created_at, updated_at, qualified_at, validation_completed_at, data_qualificacao, synced_at
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
                $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, NOW()
              )
              ON CONFLICT (id) DO UPDATE SET
                empresa = EXCLUDED.empresa,
                setor = EXCLUDED.setor,
                cnpj = EXCLUDED.cnpj,
                telefone = EXCLUDED.telefone,
                whatsapp = EXCLUDED.whatsapp,
                email = EXCLUDED.email,
                website = EXCLUDED.website,
                linkedin = EXCLUDED.linkedin,
                cidade = EXCLUDED.cidade,
                uf = EXCLUDED.uf,
                status = EXCLUDED.status,
                qualification_score = EXCLUDED.qualification_score,
                qualification_level = EXCLUDED.qualification_level,
                pontuacao_qualificacao = EXCLUDED.pontuacao_qualificacao,
                gancho_prospeccao = EXCLUDED.gancho_prospeccao,
                contato_decisor = EXCLUDED.contato_decisor,
                approach_strategy = EXCLUDED.approach_strategy,
                capital_social = EXCLUDED.capital_social,
                regime_tributario = EXCLUDED.regime_tributario,
                cnae = EXCLUDED.cnae,
                cnae_principal = EXCLUDED.cnae_principal,
                estimated_employees = EXCLUDED.estimated_employees,
                estimated_revenue = EXCLUDED.estimated_revenue,
                google_maps_verified = EXCLUDED.google_maps_verified,
                google_maps_rating = EXCLUDED.google_maps_rating,
                google_maps_reviews = EXCLUDED.google_maps_reviews,
                website_validated = EXCLUDED.website_validated,
                bright_data_enriched = EXCLUDED.bright_data_enriched,
                email_encontrado_automaticamente = EXCLUDED.email_encontrado_automaticamente,
                tech_stack = EXCLUDED.tech_stack,
                social_media = EXCLUDED.social_media,
                bant_analysis = EXCLUDED.bant_analysis,
                next_steps = EXCLUDED.next_steps,
                updated_at = EXCLUDED.updated_at,
                qualified_at = EXCLUDED.qualified_at,
                validation_completed_at = EXCLUDED.validation_completed_at,
                data_qualificacao = EXCLUDED.data_qualificacao,
                synced_at = NOW()
            `, [
              lead.id, lead.user_id, lead.empresa, lead.setor, lead.cnpj, lead.telefone,
              lead.whatsapp, lead.email, lead.website, lead.linkedin, lead.cidade, lead.uf,
              lead.status, lead.qualification_score, lead.qualification_level, lead.pontuacao_qualificacao,
              lead.gancho_prospeccao, lead.contato_decisor, lead.approach_strategy, lead.capital_social,
              lead.regime_tributario, lead.cnae, lead.cnae_principal, lead.estimated_employees,
              lead.estimated_revenue, lead.google_maps_verified, lead.google_maps_rating,
              lead.google_maps_reviews, lead.website_validated, lead.bright_data_enriched,
              lead.email_encontrado_automaticamente,
              lead.tech_stack ? JSON.stringify(lead.tech_stack) : null,
              lead.social_media ? JSON.stringify(lead.social_media) : null,
              lead.bant_analysis ? JSON.stringify(lead.bant_analysis) : null,
              lead.next_steps ? JSON.stringify(lead.next_steps) : null,
              lead.created_at, lead.updated_at, lead.qualified_at,
              lead.validation_completed_at, lead.data_qualificacao
            ]);
            synced++;
          } catch (err) {
            console.error(`Error syncing lead ${lead.id}:`, err);
            errors++;
          }
        }
        
        console.log(`Processed batch ${Math.floor(i / batchSize) + 1}: ${synced} synced, ${errors} errors`);
      }
    }

    await pgClient.end();

    const result = {
      success: true,
      synced,
      errors,
      total: leads?.length || 0,
      syncType: fullSync ? 'full' : 'incremental',
      lastSyncTime,
      timestamp: new Date().toISOString()
    };

    console.log('Sync completed:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Sync error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
