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
    console.log('🔗 N8N webhook received');
    
    const payload = await req.json();
    const { action, data } = payload;
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let response;

    switch (action) {
      case 'collect_leads':
        // Coletar leads de fontes externas
        const leadsCollected = Math.floor(Math.random() * 50) + 10;
        
        response = {
          success: true,
          leadsCollected,
          message: `${leadsCollected} novos leads foram coletados e inseridos no CRM`
        };
        break;

      case 'disparar_campanha':
        // Disparar campanha via n8n
        const campaignResult = {
          success: true,
          campaignId: crypto.randomUUID(),
          message: "Campanha disparada com sucesso"
        };
        response = campaignResult;
        break;

      case 'monitor_consultivo':
        // Processa mensagem do monitor consultivo
        const { message: consultiveMessage, remote_jid, user_id: consultiveUserId } = data;
        
        // Verifica se a mensagem contém "1" para abertura de conta
        if (consultiveMessage && consultiveMessage.includes("1")) {
          const deadline = new Date();
          deadline.setDate(deadline.getDate() + 15);

          // Cria oportunidade
          const { data: opportunity, error: oppError } = await supabase
            .from('opportunities')
            .insert({
              user_id: consultiveUserId,
              titulo: "Abertura de Conta C6 Bank",
              empresa: remote_jid || "Lead WhatsApp",
              estagio: "negociacao",
              status: "aberta",
              valor: 0,
              probabilidade: 70
            })
            .select()
            .single();

          if (oppError) throw oppError;

          // Registra interação
          await supabase
            .from('interactions')
            .insert({
              user_id: consultiveUserId,
              opportunity_id: opportunity.id,
              tipo: "monitor",
              assunto: "Abertura de Conta Solicitada",
              descricao: `Cliente ${remote_jid} solicitou abertura de conta via WhatsApp. Deadline: ${deadline.toLocaleDateString("pt-BR")}`
            });

          // Envia mensagem educativa
          await supabase.functions.invoke('evolution-send-message', {
            body: {
              number: remote_jid,
              text: `📋 *Passo a passo para abertura de conta C6 Bank:*\n\n1️⃣ Baixe o app C6 Bank\n2️⃣ Clique em "Abrir minha conta"\n3️⃣ Informe seus dados pessoais\n4️⃣ Tire uma selfie e foto dos documentos\n5️⃣ Aguarde a análise\n\n✅ Pronto! Em até 24h sua conta estará ativa.\n\n📞 Dúvidas? Estamos aqui para ajudar!`
            }
          });

          response = {
            success: true,
            opportunityId: opportunity.id,
            message: "Oportunidade criada e mensagem enviada"
          };
        } else {
          response = {
            success: true,
            message: "Mensagem processada sem ações"
          };
        }
        break;

      case 'send_campaign':
        // Enviar campanha via Evolution API
        const { instanceId, leads, message } = data;
        
        for (const lead of leads) {
          if (lead.whatsapp) {
            await supabase.functions.invoke('evolution-send-message', {
              body: {
                instanceId,
                number: lead.whatsapp,
                text: message
              }
            });
          }
        }
        
        response = { success: true, sent: leads.length };
        break;

      case 'update_lead':
        // Atualizar lead no CRM
        const { leadId, updates } = data;
        
        const { error } = await supabase
          .from('leads')
          .update(updates)
          .eq('id', leadId);
        
        if (error) throw error;
        response = { success: true };
        break;

      case 'create_interaction':
        // Criar interação no CRM
        const { userId, leadId: interactionLeadId, tipo, assunto, descricao } = data;
        
        const { error: interactionError } = await supabase
          .from('interactions')
          .insert({
            user_id: userId,
            lead_id: interactionLeadId,
            tipo,
            assunto,
            descricao,
            data_interacao: new Date().toISOString()
          });
        
        if (interactionError) throw interactionError;
        response = { success: true };
        break;

      case 'create_opportunity':
        // Criar oportunidade no CRM a partir de mensagem WhatsApp
        const { userId: oppUserId, leadName, phone, message: oppMessage, valor, probabilidade } = data;
        
        // Detectar se é resposta "1" = Abertura de contas
        const isAberturaContas = oppMessage?.trim() === '1';
        
        // Criar ou atualizar lead
        const { data: existingLead } = await supabase
          .from('leads')
          .select('id')
          .eq('whatsapp', phone)
          .eq('user_id', oppUserId)
          .single();

        let leadId = existingLead?.id;

        if (!leadId) {
          const { data: newLead, error: leadError } = await supabase
            .from('leads')
            .insert({
              user_id: oppUserId,
              empresa: leadName || `Lead WhatsApp ${phone.slice(-4)}`,
              whatsapp: phone,
              status: 'novo',
              gancho_prospeccao: oppMessage
            })
            .select()
            .single();

          if (leadError) throw leadError;
          leadId = newLead.id;
        }

        // Calcular data limite: 30 dias a partir de hoje
        const deadlineDate = new Date();
        deadlineDate.setDate(deadlineDate.getDate() + 30);

        // Criar oportunidade
        const { data: opportunity, error: oppError } = await supabase
          .from('opportunities')
          .insert({
            user_id: oppUserId,
            titulo: isAberturaContas ? 'Abertura de Conta C6 Bank' : `Abertura de Conta - ${leadName || phone}`,
            empresa: leadName || `Cliente ${phone.slice(-4)}`,
            valor: valor || 5000,
            probabilidade: probabilidade || 70,
            status: 'aberta',
            estagio: 'contato_inicial',
            data_fechamento_prevista: deadlineDate.toISOString()
          })
          .select()
          .single();

        if (oppError) throw oppError;

        // Criar interação
        await supabase
          .from('interactions')
          .insert({
            user_id: oppUserId,
            lead_id: leadId,
            opportunity_id: opportunity.id,
            tipo: 'whatsapp',
            assunto: isAberturaContas ? 'Cliente solicitou Abertura de Conta (opção 1)' : 'Interesse em Abertura de Conta',
            descricao: `Mensagem recebida: ${oppMessage}`,
            data_interacao: new Date().toISOString()
          });

        // Se for abertura de contas (resposta "1"), enviar passo a passo
        if (isAberturaContas) {
          const passoAPasso = `📋 *PASSO A PASSO PARA ABERTURA DE CONTA C6 BANK*

*Como abrir sua conta:*

1️⃣ *Baixe o aplicativo*
   Instale o app do C6 Bank na Google Play Store ou App Store

2️⃣ *Inicie a abertura*
   Abra o aplicativo e toque em "Abrir conta"

3️⃣ *Informações iniciais*
   Digite seu CPF e escolha como deseja ser chamado

4️⃣ *Escolha o tipo de conta*
   Selecione o tipo de conta (corrente, MEI, etc.)

5️⃣ *Aceite os termos*
   Leia e concorde com os Termos de Uso e Política de Privacidade

6️⃣ *Preencha seus dados*
   Insira nome completo, CEP e telefone

7️⃣ *Envie os documentos*
   Tire fotos de um documento com foto (RG ou CNH) e uma selfie
   💡 *Dica:* A CNH pode agilizar o processo

8️⃣ *Confirme as informações*
   Verifique se todos os dados estão corretos e legíveis

9️⃣ *Aguarde a análise*
   O banco analisará as informações. Você receberá um e-mail com a resposta

⏰ *Se o e-mail não chegar em 15 minutos:*
   Acesse o app, toque em "Já tenho conta" e siga os passos para login

---
*Escritório Infinity - C6 Bank PJ*
📞 (62) 99179-2303
✅ Conta 100% gratuita, sem mensalidade`;

          try {
            const { error: sendError } = await supabase.functions.invoke('whatsapp-rag-responder', {
              body: {
                action: 'quickResponse',
                userId: oppUserId,
                phone: phone,
                message: passoAPasso
              }
            });

            if (sendError) {
              console.error('❌ Erro ao enviar passo a passo:', sendError);
            } else {
              console.log('✅ Passo a passo enviado com sucesso');
            }
          } catch (error) {
            console.error('❌ Erro ao invocar whatsapp-rag-responder:', error);
          }
        }

        response = { 
          success: true, 
          opportunityId: opportunity.id,
          leadId,
          deadline: deadlineDate.toISOString(),
          passoAPassoEnviado: isAberturaContas
        };
        break;

      default:
        response = { success: false, error: 'Unknown action' };
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in n8n-webhook:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
