import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const googleCalendarApiKey = Deno.env.get('GOOGLE_CALENDAR_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScheduleRequest {
  leadId: string;
  userId: string;
  leadEmail: string;
  leadName: string;
  preferredDate?: string;
  preferredTime?: string;
  meetingType: 'call' | 'video' | 'in-person';
  duration: number; // em minutos
  notes?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Calendar integration function started');
    
    const body = await req.json();
    const { leadId, userId, leadEmail, leadName, preferredDate, preferredTime, meetingType = 'call', duration = 60, notes } = body as ScheduleRequest;

    if (!leadId || !userId || !leadEmail || !leadName) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Parâmetros obrigatórios: leadId, userId, leadEmail, leadName'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar dados do usuário para personalização
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, company')
      .eq('user_id', userId)
      .single();

    const consultorName = profile?.display_name || 'Consultor Tributário';
    const consultorCompany = profile?.company || 'Consultoria Tributária';

    // Gerar horários disponíveis para os próximos 7 dias úteis
    const availableSlots = generateAvailableSlots();
    
    // Se data/hora específica foi solicitada, tentar agendamento direto
    let scheduledSlot = null;
    if (preferredDate && preferredTime) {
      const requestedDateTime = new Date(`${preferredDate}T${preferredTime}`);
      const isAvailable = availableSlots.some(slot => 
        slot.date === preferredDate && slot.time === preferredTime
      );
      
      if (isAvailable) {
        scheduledSlot = {
          date: preferredDate,
          time: preferredTime,
          dateTime: requestedDateTime
        };
      }
    } else {
      // Sugerir o primeiro slot disponível
      const firstSlot = availableSlots[0];
      if (firstSlot) {
        scheduledSlot = {
          date: firstSlot.date,
          time: firstSlot.time,
          dateTime: new Date(`${firstSlot.date}T${firstSlot.time}`)
        };
      }
    }

    if (!scheduledSlot) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Horário solicitado não disponível',
        availableSlots: availableSlots.slice(0, 5) // Primeiros 5 slots
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Criar evento no "calendário" (simulado - salvando no banco)
    const eventData = {
      user_id: userId,
      lead_id: leadId,
      lead_name: leadName,
      lead_email: leadEmail,
      scheduled_date: scheduledSlot.dateTime.toISOString(),
      meeting_type: meetingType,
      duration_minutes: duration,
      status: 'agendado',
      notes: notes || `Reunião agendada via WhatsApp RAG com ${leadName}`,
      created_at: new Date().toISOString()
    };

    // Salvar no banco de dados
    let { data: savedEvent, error: saveError } = await supabase
      .from('scheduled_meetings')
      .insert(eventData)
      .select()
      .single();

    if (saveError) {
      console.error('Erro ao salvar evento:', saveError);
      
      // Tentar salvar novamente diretamente (sem usar RPC que pode causar problemas)
      const { data: retryEvent, error: retryError } = await supabase
        .from('scheduled_meetings')
        .insert(eventData)
        .select()
        .single();
        
      if (retryError) {
        throw new Error(`Erro ao criar agendamento: ${retryError.message}`);
      }
      
      savedEvent = retryEvent;
    }

    // Registrar interação no CRM
    await supabase
      .from('interactions')
      .insert({
        user_id: userId,
        contact_id: leadId,
        tipo: 'agendamento',
        assunto: `Ligação agendada - ${meetingType}`,
        descricao: `Reunião agendada para ${scheduledSlot.date} às ${scheduledSlot.time} (${duration} min)`,
        data_interacao: new Date().toISOString(),
        proximo_followup: scheduledSlot.dateTime.toISOString().split('T')[0]
      });

    // Gerar link de reunião (simulado)
    const meetingLink = generateMeetingLink(savedEvent.id);

    // Formatar resposta para WhatsApp
    const whatsappMessage = formatWhatsAppScheduleMessage({
      leadName,
      consultorName,
      consultorCompany,
      date: formatDate(scheduledSlot.dateTime),
      time: formatTime(scheduledSlot.dateTime),
      meetingType,
      duration,
      meetingLink
    });

    console.log('Agendamento criado com sucesso:', savedEvent.id);

    return new Response(JSON.stringify({
      success: true,
      message: 'Ligação agendada com sucesso!',
      eventId: savedEvent.id,
      scheduledDateTime: scheduledSlot.dateTime.toISOString(),
      meetingLink,
      whatsappMessage,
      calendarInvite: {
        subject: `Consultoria Tributária - ${leadName}`,
        description: `Reunião de consultoria tributária com ${consultorName} da ${consultorCompany}`,
        startTime: scheduledSlot.dateTime.toISOString(),
        endTime: new Date(scheduledSlot.dateTime.getTime() + duration * 60000).toISOString(),
        attendees: [leadEmail]
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in calendar-integration function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateAvailableSlots() {
  const slots = [];
  const now = new Date();
  
  for (let day = 1; day <= 7; day++) {
    const date = new Date(now);
    date.setDate(now.getDate() + day);
    
    // Pular fins de semana
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    
    const dateStr = date.toISOString().split('T')[0];
    
    // Horários disponíveis: 9h às 17h
    const times = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
    
    times.forEach(time => {
      slots.push({
        date: dateStr,
        time: time,
        formatted: `${formatDateBR(date)} às ${time}`
      });
    });
  }
  
  return slots;
}

function generateMeetingLink(eventId: string): string {
  // Em produção, integraria com Google Meet, Zoom, etc.
  return `https://meet.google.com/abc-defg-hij?eventId=${eventId}`;
}

function formatWhatsAppScheduleMessage(data: any): string {
  return `🗓️ *AGENDAMENTO CONFIRMADO* ✅

Olá *${data.leadName}*!

Sua ligação de consultoria tributária foi agendada com sucesso:

📅 *Data:* ${data.date}
⏰ *Horário:* ${data.time}
👨‍💼 *Consultor:* ${data.consultorName}
🏢 *Empresa:* ${data.consultorCompany}
📞 *Tipo:* ${data.meetingType === 'call' ? 'Ligação telefônica' : data.meetingType === 'video' ? 'Videoconferência' : 'Presencial'}
⏱️ *Duração:* ${data.duration} minutos

${data.meetingType === 'video' ? `🔗 *Link da reunião:* ${data.meetingLink}` : ''}

📧 Em breve você receberá um convite no seu e-mail com todos os detalhes.

🎯 *Prepare-se para descobrir como otimizar sua carga tributária!*

Qualquer dúvida, é só me chamar! 😊`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatDateBR(date: Date): string {
  return date.toLocaleDateString('pt-BR');
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });
}