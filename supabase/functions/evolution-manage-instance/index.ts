import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('⚙️ Evolution manage instance function started');
    
    const { action, instanceId, instanceData } = await req.json();
    
    if (!action) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'action é obrigatório'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Autorização necessária'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });

    // Verificar usuário autenticado
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Usuário não autenticado'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    switch (action) {
      case 'create':
        return await createInstance(supabase, user.id, instanceData);
      
      case 'connect':
        return await connectInstance(supabase, instanceId);
      
      case 'disconnect':
        return await disconnectInstance(supabase, instanceId);
      
      case 'status':
        return await getInstanceStatus(supabase, instanceId);
      
      case 'qrcode':
        return await getQRCode(supabase, instanceId);
      
      case 'delete':
        return await deleteInstance(supabase, instanceId);
      
      default:
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Ação inválida'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

  } catch (error) {
    console.error('❌ Error in evolution-manage-instance:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function createInstance(supabase: any, userId: string, instanceData: any) {
  console.log('🆕 Creating new instance');
  
  const { instanceName, instanceUrl, apiKey } = instanceData;
  
  if (!instanceName || !instanceUrl || !apiKey) {
    return new Response(JSON.stringify({ 
      success: false,
      error: 'instanceName, instanceUrl e apiKey são obrigatórios'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Criar instância na Evolution API
  const evolutionUrl = `${instanceUrl}/instance/create`;
  const evolutionResponse = await fetch(evolutionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey
    },
    body: JSON.stringify({
      instanceName: instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS'
    })
  });

  if (!evolutionResponse.ok) {
    const errorData = await evolutionResponse.json();
    throw new Error(`Erro ao criar instância na Evolution API: ${JSON.stringify(errorData)}`);
  }

  const evolutionData = await evolutionResponse.json();
  console.log('✅ Instance created in Evolution API:', evolutionData);

  // Salvar no banco de dados
  const { data: savedInstance, error: saveError } = await supabase
    .from('evolution_instances')
    .insert({
      user_id: userId,
      instance_name: instanceName,
      instance_url: instanceUrl,
      api_key: apiKey,
      status: 'disconnected',
      is_active: true
    })
    .select()
    .single();

  if (saveError) {
    throw saveError;
  }

  // Configurar webhook na Evolution API
  const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/evolution-webhook`;
  await fetch(`${instanceUrl}/webhook/set/${instanceName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey
    },
    body: JSON.stringify({
      url: webhookUrl,
      webhook_by_events: false,
      webhook_base64: false,
      events: [
        'QRCODE_UPDATED',
        'CONNECTION_UPDATE',
        'MESSAGES_UPSERT',
        'MESSAGES_UPDATE',
        'CALL_RECEIVED'
      ]
    })
  });

  return new Response(JSON.stringify({ 
    success: true,
    data: savedInstance
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function connectInstance(supabase: any, instanceId: string) {
  console.log('🔌 Connecting instance:', instanceId);
  
  const { data: instance, error: instanceError } = await supabase
    .from('evolution_instances')
    .select('*')
    .eq('id', instanceId)
    .single();

  if (instanceError || !instance) {
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Instância não encontrada'
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Solicitar conexão na Evolution API
  const evolutionUrl = `${instance.instance_url}/instance/connect/${instance.instance_name}`;
  const evolutionResponse = await fetch(evolutionUrl, {
    method: 'GET',
    headers: {
      'apikey': instance.api_key
    }
  });

  if (!evolutionResponse.ok) {
    const errorData = await evolutionResponse.json();
    throw new Error(`Erro ao conectar instância: ${JSON.stringify(errorData)}`);
  }

  const evolutionData = await evolutionResponse.json();
  console.log('📱 QR Code data:', evolutionData);

  // Atualizar status e QR code
  const updateData: any = {
    status: 'qr_code',
    updated_at: new Date().toISOString()
  };

  if (evolutionData.qrcode || evolutionData.base64) {
    updateData.qr_code = evolutionData.qrcode || evolutionData.base64;
  }

  await supabase
    .from('evolution_instances')
    .update(updateData)
    .eq('id', instanceId);

  return new Response(JSON.stringify({ 
    success: true,
    qrcode: updateData.qr_code,
    data: evolutionData
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function disconnectInstance(supabase: any, instanceId: string) {
  console.log('🔌 Disconnecting instance:', instanceId);
  
  const { data: instance, error: instanceError } = await supabase
    .from('evolution_instances')
    .select('*')
    .eq('id', instanceId)
    .single();

  if (instanceError || !instance) {
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Instância não encontrada'
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Desconectar na Evolution API
  const evolutionUrl = `${instance.instance_url}/instance/logout/${instance.instance_name}`;
  await fetch(evolutionUrl, {
    method: 'DELETE',
    headers: {
      'apikey': instance.api_key
    }
  });

  // Atualizar status
  await supabase
    .from('evolution_instances')
    .update({ 
      status: 'disconnected',
      qr_code: null,
      phone_number: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', instanceId);

  return new Response(JSON.stringify({ 
    success: true
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getInstanceStatus(supabase: any, instanceId: string) {
  const { data: instance, error: instanceError } = await supabase
    .from('evolution_instances')
    .select('*')
    .eq('id', instanceId)
    .single();

  if (instanceError || !instance) {
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Instância não encontrada'
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Buscar status na Evolution API
  try {
    const evolutionUrl = `${instance.instance_url}/instance/connectionState/${instance.instance_name}`;
    const evolutionResponse = await fetch(evolutionUrl, {
      method: 'GET',
      headers: {
        'apikey': instance.api_key
      }
    });

    if (evolutionResponse.ok) {
      const evolutionData = await evolutionResponse.json();
      
      // Atualizar status local se necessário
      const state = evolutionData.state || evolutionData.status;
      if (state === 'open' && instance.status !== 'connected') {
        await supabase
          .from('evolution_instances')
          .update({ status: 'connected' })
          .eq('id', instanceId);
      }
    }
  } catch (error) {
    console.error('Error fetching status from Evolution API:', error);
  }

  return new Response(JSON.stringify({ 
    success: true,
    data: instance
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getQRCode(supabase: any, instanceId: string) {
  const { data: instance, error: instanceError } = await supabase
    .from('evolution_instances')
    .select('*')
    .eq('id', instanceId)
    .single();

  if (instanceError || !instance) {
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Instância não encontrada'
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ 
    success: true,
    qrcode: instance.qr_code
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function deleteInstance(supabase: any, instanceId: string) {
  console.log('🗑️ Deleting instance:', instanceId);
  
  const { data: instance, error: instanceError } = await supabase
    .from('evolution_instances')
    .select('*')
    .eq('id', instanceId)
    .single();

  if (instanceError || !instance) {
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Instância não encontrada'
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Deletar na Evolution API
  try {
    const evolutionUrl = `${instance.instance_url}/instance/delete/${instance.instance_name}`;
    await fetch(evolutionUrl, {
      method: 'DELETE',
      headers: {
        'apikey': instance.api_key
      }
    });
  } catch (error) {
    console.error('Error deleting from Evolution API:', error);
  }

  // Deletar do banco (cascade deletes messages)
  await supabase
    .from('evolution_instances')
    .delete()
    .eq('id', instanceId);

  return new Response(JSON.stringify({ 
    success: true
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
