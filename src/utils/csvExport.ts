import { Target } from '@/data/knowledgeBase';

export interface Lead {
  id?: string;
  empresa?: string;
  setor?: string;
  cnae?: string;
  regime_tributario?: string;
  contato_decisor?: string;
  telefone?: string;
  email?: string;
  website?: string;
  gancho_prospeccao?: string;
  status?: string;
  created_at?: string;
}

export interface Contact {
  id?: string;
  nome?: string;
  empresa?: string;
  cargo?: string;
  email?: string;
  telefone?: string;
  website?: string;
  status?: string;
  observacoes?: string;
  created_at?: string;
}

export interface Opportunity {
  id?: string;
  titulo?: string;
  empresa?: string;
  valor?: number;
  probabilidade?: number;
  estagio?: string;
  data_fechamento_esperada?: string;
  observacoes?: string;
  created_at?: string;
}

// Função para converter dados para CSV
export function convertToCSV(data: any[], headers: string[]): string {
  const csvHeaders = headers.join(',');
  const csvRows = data.map(row => 
    headers.map(header => {
      const value = row[header] || '';
      // Escapar aspas duplas e quebras de linha
      const escapedValue = String(value).replace(/"/g, '""');
      // Envolver em aspas se contém vírgula, quebra de linha ou aspas
      return /[,\n\r"]/.test(escapedValue) ? `"${escapedValue}"` : escapedValue;
    }).join(',')
  );
  
  return [csvHeaders, ...csvRows].join('\n');
}

// Função para baixar CSV
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Exportar leads para CSV
export function exportLeadsToCSV(leads: Lead[]): void {
  const headers = [
    'empresa', 'setor', 'cnae', 'regime_tributario', 'contato_decisor', 
    'telefone', 'email', 'website', 'gancho_prospeccao', 'status'
  ];
  
  // Garantir que todos os leads tenham pelo menos uma empresa
  const sanitizedLeads = leads.map(lead => ({
    ...lead,
    empresa: lead.empresa || 'Empresa não informada'
  }));
  
  const csvContent = convertToCSV(sanitizedLeads, headers);
  const filename = `leads_${new Date().toISOString().split('T')[0]}.csv`;
  downloadCSV(csvContent, filename);
}

// Exportar contatos para CSV
export function exportContactsToCSV(contacts: Contact[]): void {
  const headers = [
    'nome', 'empresa', 'cargo', 'email', 'telefone', 'website', 'status', 'observacoes'
  ];
  
  // Garantir que todos os contatos tenham pelo menos um nome
  const sanitizedContacts = contacts.map(contact => ({
    ...contact,
    nome: contact.nome || 'Nome não informado'
  }));
  
  const csvContent = convertToCSV(sanitizedContacts, headers);
  const filename = `contatos_${new Date().toISOString().split('T')[0]}.csv`;
  downloadCSV(csvContent, filename);
}

// Exportar oportunidades para CSV
export function exportOpportunitiesToCSV(opportunities: Opportunity[]): void {
  const headers = [
    'titulo', 'empresa', 'valor', 'probabilidade', 'estagio', 
    'data_fechamento_esperada', 'observacoes'
  ];
  
  // Garantir que todas as oportunidades tenham pelo menos título e empresa
  const sanitizedOpportunities = opportunities.map(opp => ({
    ...opp,
    titulo: opp.titulo || 'Oportunidade sem título',
    empresa: opp.empresa || 'Empresa não informada'
  }));
  
  const csvContent = convertToCSV(sanitizedOpportunities, headers);
  const filename = `oportunidades_${new Date().toISOString().split('T')[0]}.csv`;
  downloadCSV(csvContent, filename);
}

// Função para criar planilha Excel com múltiplas abas (usando SheetJS quando disponível)
export function exportToExcel(data: { 
  alvos: Target[], 
  leads: Lead[], 
  roteiros: any[] 
}): void {
  // Para implementação futura com SheetJS
  // Por enquanto, exportamos CSVs separados
  
  // Exportar alvos
  const alvosHeaders = [
    'empresa', 'setor', 'cnae', 'regime_tributario', 'contato_decisor',
    'telefone', 'email', 'website', 'gancho_prospeccao'
  ];
  const alvosCSV = convertToCSV(data.alvos, alvosHeaders);
  downloadCSV(alvosCSV, `alvos_${new Date().toISOString().split('T')[0]}.csv`);
  
  // Exportar leads
  if (data.leads.length > 0) {
    exportLeadsToCSV(data.leads);
  }
  
  // Exportar roteiros
  if (data.roteiros.length > 0) {
    const roteirosHeaders = ['empresa', 'roteiro_ligacao', 'modelo_email'];
    const roteirosCSV = convertToCSV(data.roteiros, roteirosHeaders);
    downloadCSV(roteirosCSV, `roteiros_${new Date().toISOString().split('T')[0]}.csv`);
  }
}

// Função para salvar lead automaticamente em CSV (simulação)
export function saveLeadToCSV(lead: Lead): void {
  // Em uma implementação real, isso salvaria no servidor
  // Por agora, apenas simula o salvamento
  console.log('Lead salvo automaticamente:', lead);
  
  // Opcionalmente, podemos manter um array local de leads
  const existingLeads = JSON.parse(localStorage.getItem('prospected_leads') || '[]');
  existingLeads.push({ ...lead, id: Date.now().toString(), created_at: new Date().toISOString() });
  localStorage.setItem('prospected_leads', JSON.stringify(existingLeads));
}

// Função para recuperar leads salvos
export function getSavedLeads(): Lead[] {
  return JSON.parse(localStorage.getItem('prospected_leads') || '[]');
}