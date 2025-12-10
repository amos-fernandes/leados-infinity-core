import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from 'https://deno.land/x/postgres@v0.17.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { page = 1, pageSize = 50, searchTerm = '', userId } = await req.json();

    console.log('📊 External Leads Query:', { page, pageSize, searchTerm, userId });

    const n8nDbUrl = Deno.env.get('N8N_POSTGRES_URL');
    if (!n8nDbUrl) {
      throw new Error('N8N_POSTGRES_URL não configurado');
    }

    // Parse da URL do PostgreSQL
    const url = new URL(n8nDbUrl);
    const dbConfig = {
      hostname: url.hostname,
      port: parseInt(url.port || '5432'),
      database: url.pathname.replace('/', ''),
      user: url.username,
      password: url.password,
      tls: { enabled: false }, // sslmode=disable
    };

    console.log('🔌 Conectando ao PostgreSQL externo:', {
      hostname: dbConfig.hostname,
      port: dbConfig.port,
      database: dbConfig.database,
    });

    const client = new Client(dbConfig);
    await client.connect();

    // Ensure leads table exists with correct schema
    await client.queryArray(`
      DROP TABLE IF EXISTS leads;
      CREATE TABLE leads (
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
    console.log('✅ Tabela leads recriada no banco externo');

    const offset = (page - 1) * pageSize;

    // Build query with optional search
    let whereClause = '';
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (userId) {
      whereClause = `WHERE user_id = $${paramIndex}`;
      queryParams.push(userId);
      paramIndex++;
    }

    if (searchTerm) {
      const searchCondition = `(empresa ILIKE $${paramIndex} OR cnpj ILIKE $${paramIndex + 1} OR setor ILIKE $${paramIndex + 2})`;
      if (whereClause) {
        whereClause += ` AND ${searchCondition}`;
      } else {
        whereClause = `WHERE ${searchCondition}`;
      }
      const searchPattern = `%${searchTerm}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
      paramIndex += 3;
    }

    // Query for leads with pagination
    const leadsQuery = `
      SELECT id, empresa, cnpj, setor, status, telefone, whatsapp, email, 
             website, linkedin, cidade, uf, created_at, updated_at,
             qualification_score, qualification_level, pontuacao_qualificacao
      FROM leads
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    queryParams.push(pageSize, offset);

    console.log('🔍 Executing query:', leadsQuery);
    console.log('📋 Params:', queryParams);

    const leadsResult = await client.queryObject(leadsQuery, queryParams);

    // Get approximate count (faster than exact count for large tables)
    let countQuery = 'SELECT COUNT(*) as total FROM leads';
    let countParams: any[] = [];
    
    if (userId || searchTerm) {
      let countWhere = '';
      let countParamIndex = 1;
      
      if (userId) {
        countWhere = `WHERE user_id = $${countParamIndex}`;
        countParams.push(userId);
        countParamIndex++;
      }
      
      if (searchTerm) {
        const searchCondition = `(empresa ILIKE $${countParamIndex} OR cnpj ILIKE $${countParamIndex + 1} OR setor ILIKE $${countParamIndex + 2})`;
        if (countWhere) {
          countWhere += ` AND ${searchCondition}`;
        } else {
          countWhere = `WHERE ${searchCondition}`;
        }
        const searchPattern = `%${searchTerm}%`;
        countParams.push(searchPattern, searchPattern, searchPattern);
      }
      
      countQuery = `SELECT COUNT(*) as total FROM leads ${countWhere}`;
    }

    const countResult = await client.queryObject(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0]?.total as string || '0');

    await client.end();

    const leads = leadsResult.rows;
    const totalPages = Math.ceil(totalCount / pageSize);
    const hasMore = page < totalPages;

    console.log(`✅ Retornando ${leads.length} leads de ${totalCount} total`);

    return new Response(
      JSON.stringify({
        success: true,
        leads,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages,
          hasMore,
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('❌ Erro na query:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        leads: [],
        pagination: { page: 1, pageSize: 50, totalCount: 0, totalPages: 0, hasMore: false }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
