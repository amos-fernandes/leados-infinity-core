import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper para conectar ao PostgreSQL do n8n
async function connectToN8nPostgres() {
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
  };

  console.log('🔌 Conectando ao PostgreSQL n8n:', {
    hostname: dbConfig.hostname,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user
  });

  // Usando driver PostgreSQL do Deno
  const { Client } = await import('https://deno.land/x/postgres@v0.17.0/mod.ts');
  const client = new Client(dbConfig);
  await client.connect();
  
  return client;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tables, userId } = await req.json();

    console.log('📊 Iniciando sincronização para tabelas:', tables);
    console.log('👤 User ID:', userId);

    // Conecta ao Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Conecta ao PostgreSQL do n8n
    const n8nClient = await connectToN8nPostgres();

    const results: Record<string, any> = {};

    // Sincroniza cada tabela
    for (const table of tables) {
      try {
        console.log(`\n🔄 Sincronizando tabela: ${table}`);

        // Busca dados do Supabase
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .eq('user_id', userId);

        if (error) {
          console.error(`❌ Erro ao buscar ${table}:`, error);
          results[table] = { error: error.message, synced: 0 };
          continue;
        }

        console.log(`📦 ${data?.length || 0} registros encontrados em ${table}`);

        if (!data || data.length === 0) {
          results[table] = { synced: 0, message: 'Nenhum dado para sincronizar' };
          continue;
        }

        // Cria a tabela no n8n postgres se não existir
        const createTableSQL = generateCreateTableSQL(table, data[0]);
        console.log(`🏗️ Criando/verificando tabela no n8n:`, table);
        await n8nClient.queryArray(createTableSQL);

        // Limpa dados antigos do usuário
        await n8nClient.queryArray(
          `DELETE FROM leados_${table} WHERE user_id = $1`,
          [userId]
        );

        // Insere novos dados
        let syncedCount = 0;
        for (const row of data) {
          const insertSQL = generateInsertSQL(table, row);
          await n8nClient.queryArray(insertSQL.query, insertSQL.values);
          syncedCount++;
        }

        console.log(`✅ ${syncedCount} registros sincronizados em ${table}`);
        results[table] = { synced: syncedCount };

      } catch (tableError: any) {
        console.error(`❌ Erro ao sincronizar ${table}:`, tableError);
        results[table] = { error: tableError.message, synced: 0 };
      }
    }

    await n8nClient.end();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sincronização concluída',
        results,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('❌ Erro na sincronização:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

// Gera SQL para criar tabela baseado em um registro de exemplo
function generateCreateTableSQL(tableName: string, sampleRow: any): string {
  const columns: string[] = [];
  
  for (const [key, value] of Object.entries(sampleRow)) {
    let type = 'TEXT';
    
    if (typeof value === 'number') {
      type = Number.isInteger(value) ? 'INTEGER' : 'NUMERIC';
    } else if (typeof value === 'boolean') {
      type = 'BOOLEAN';
    } else if (value instanceof Date || (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/))) {
      type = 'TIMESTAMP';
    } else if (typeof value === 'object' && value !== null) {
      type = 'JSONB';
    }
    
    columns.push(`"${key}" ${type}`);
  }

  return `
    CREATE TABLE IF NOT EXISTS leados_${tableName} (
      ${columns.join(',\n      ')}
    );
    CREATE INDEX IF NOT EXISTS idx_leados_${tableName}_user_id ON leados_${tableName}(user_id);
  `;
}

// Gera SQL para insert
function generateInsertSQL(tableName: string, row: any): { query: string; values: any[] } {
  const keys = Object.keys(row);
  const values = Object.values(row).map(v => 
    typeof v === 'object' && v !== null ? JSON.stringify(v) : v
  );
  
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const columns = keys.map(k => `"${k}"`).join(', ');
  
  return {
    query: `INSERT INTO leados_${tableName} (${columns}) VALUES (${placeholders})`,
    values
  };
}
