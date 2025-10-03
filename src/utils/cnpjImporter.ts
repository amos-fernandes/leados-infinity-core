import { supabase } from '@/integrations/supabase/client';

export interface CNPJRecord {
  cnpj: string;
  razao_social: string;
  porte: string;
  capital_social: string;
  natureza_juridica: string;
  data_abertura: string;
  nome_fantasia: string;
  situacao_cadastral: string;
  telefone_principal: string;
  telefone_secundario: string;
  email: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  atividade_principal: string;
}

// Limpa e formata telefone brasileiro
function formatBrazilianPhone(phone: string): string {
  if (!phone) return '';
  // Remove todos os caracteres não numéricos
  const cleaned = phone.replace(/\D/g, '');
  // Adiciona +55 se não tiver
  if (cleaned.length >= 10 && !cleaned.startsWith('55')) {
    return `+55${cleaned}`;
  }
  if (cleaned.startsWith('55')) {
    return `+${cleaned}`;
  }
  return cleaned;
}

// Determina o setor baseado no CNAE
function determineSetor(atividadePrincipal: string): string {
  const atividade = atividadePrincipal.toLowerCase();
  
  if (atividade.includes('comércio') || atividade.includes('varejo')) return 'Comércio';
  if (atividade.includes('serviço') || atividade.includes('consultoria')) return 'Serviços';
  if (atividade.includes('indústria') || atividade.includes('fabricação')) return 'Indústria';
  if (atividade.includes('tecnologia') || atividade.includes('software')) return 'Tecnologia';
  if (atividade.includes('saúde') || atividade.includes('médico')) return 'Saúde';
  if (atividade.includes('educação') || atividade.includes('ensino')) return 'Educação';
  
  return 'Outros';
}

// Determina o regime tributário baseado no porte
function determineRegimeTributario(porte: string): string {
  const porteUpper = porte.toUpperCase();
  
  if (porteUpper.includes('ME') || porteUpper.includes('MICROEMPRESA')) return 'Simples Nacional';
  if (porteUpper.includes('EPP') || porteUpper.includes('PEQUENO PORTE')) return 'Simples Nacional';
  if (porteUpper.includes('MÉDIO') || porteUpper.includes('MEDIO')) return 'Lucro Presumido';
  if (porteUpper.includes('GRANDE')) return 'Lucro Real';
  
  return 'Simples Nacional';
}

export async function parseCNPJCSV(fileContent: string): Promise<CNPJRecord[]> {
  console.log('🔍 Iniciando parse do CSV...');
  
  const lines = fileContent.split('\n').filter(line => line.trim());
  console.log(`📊 Total de linhas: ${lines.length}`);
  
  if (lines.length === 0) {
    console.log('❌ Nenhuma linha encontrada');
    return [];
  }
  
  // Analisar primeira linha para detectar formato
  const firstLine = lines[0];
  const firstLineColumns = firstLine.split(';').length;
  console.log(`📋 Primeira linha tem ${firstLineColumns} colunas`);
  console.log(`📝 Primeira linha: ${firstLine.substring(0, 100)}...`);
  
  const records: CNPJRecord[] = [];
  
  // Detectar formato pelo número de colunas
  // Formato simplificado: 4 colunas (CNPJ;Razão Social;socio;celular)
  // Formato completo: 30+ colunas
  const isSimpleFormat = firstLineColumns <= 5;
  
  console.log(`✅ Formato detectado: ${isSimpleFormat ? 'SIMPLIFICADO (4 colunas)' : 'COMPLETO (30+ colunas)'}`);
  
  if (isSimpleFormat) {
    // Pula cabeçalho (primeira linha)
    const dataLines = lines.slice(1);
    console.log(`📦 Processando ${dataLines.length} linhas de dados...`);
    
    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i];
      const values = line.split(';').map(v => v.trim().replace(/^"|"$/g, ''));
      
      // Debug primeira linha de dados
      if (i === 0) {
        console.log(`🔎 Primeira linha de dados tem ${values.length} valores:`, values);
      }
      
      // Validar se tem as 4 colunas mínimas
      if (values.length < 4) {
        console.log(`⚠️  Linha ${i + 2} ignorada: apenas ${values.length} colunas`);
        continue;
      }
      
      // Validar se tem CNPJ e razão social válidos
      if (!values[0] || values[0].length < 14 || !values[1] || values[1].length < 3) {
        console.log(`⚠️  Linha ${i + 2} ignorada: CNPJ ou razão social inválidos`);
        continue;
      }
      
      records.push({
        cnpj: values[0],
        razao_social: values[1],
        porte: 'Não informado',
        capital_social: '0',
        natureza_juridica: 'Não informado',
        data_abertura: '',
        nome_fantasia: values[1], // Usar razão social como nome fantasia
        situacao_cadastral: 'Ativa',
        telefone_principal: values[3] || '',
        telefone_secundario: '',
        email: '',
        logradouro: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        estado: '',
        cep: '',
        atividade_principal: 'Não informado'
      });
      
      // Log progresso a cada 100 registros
      if ((i + 1) % 100 === 0) {
        console.log(`✅ Processados ${i + 1} registros...`);
      }
    }
  } else {
    // Formato completo
    const dataLines = lines.slice(2);
    console.log(`📦 Processando ${dataLines.length} linhas de dados (formato completo)...`);
    
    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i];
      const values = line.split(';').map(v => v.trim().replace(/^"|"$/g, ''));
      
      if (values.length < 30) {
        console.log(`⚠️  Linha ${i + 3} ignorada: apenas ${values.length} colunas`);
        continue;
      }
      
      records.push({
        cnpj: values[0],
        razao_social: values[1],
        porte: values[3],
        capital_social: values[4],
        natureza_juridica: values[6],
        data_abertura: values[9],
        nome_fantasia: values[10],
        situacao_cadastral: values[12],
        telefone_principal: values[19],
        telefone_secundario: values[20],
        email: values[21],
        logradouro: values[23],
        numero: values[24],
        complemento: values[25],
        bairro: values[26],
        cidade: values[27],
        estado: values[28],
        cep: values[29],
        atividade_principal: values[33]
      });
      
      if ((i + 1) % 100 === 0) {
        console.log(`✅ Processados ${i + 1} registros...`);
      }
    }
  }
  
  console.log(`✅ Parse concluído! ${records.length} registros válidos encontrados`);
  return records;
}

export async function importCNPJToLeads(
  records: CNPJRecord[], 
  userId: string,
  onProgress?: (current: number, total: number) => void
): Promise<{ success: number; errors: number; messages: string[] }> {
  let success = 0;
  let errors = 0;
  const messages: string[] = [];
  
  const batchSize = 50;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, Math.min(i + batchSize, records.length));
    
    const leadsToInsert = batch.map(record => {
      const telefoneFormatado = formatBrazilianPhone(record.telefone_principal);
      
      return {
        user_id: userId,
        empresa: record.nome_fantasia || record.razao_social,
        cnpj: record.cnpj,
        setor: determineSetor(record.atividade_principal),
        cnae: record.atividade_principal,
        regime_tributario: determineRegimeTributario(record.porte),
        telefone: telefoneFormatado,
        whatsapp: telefoneFormatado, // Telefone principal como WhatsApp
        email: record.email || null,
        cidade: record.cidade,
        uf: record.estado,
        website: null,
        status: 'qualificado', // Importar como qualificado
        qualification_level: 'high',
        capital_social: record.capital_social ? parseFloat(record.capital_social.replace(/[^\d,]/g, '').replace(',', '.')) : null,
        gancho_prospeccao: `Empresa ativa no setor de ${determineSetor(record.atividade_principal)}`,
        contato_decisor: null,
        qualification_score: '80', // Score alto para leads importados
        google_maps_verified: false,
        website_validated: false,
        email_encontrado_automaticamente: false
      };
    });
    
    const { error } = await supabase
      .from('leads')
      .insert(leadsToInsert);
    
    if (error) {
      errors += batch.length;
      messages.push(`Erro no lote ${i / batchSize + 1}: ${error.message}`);
      console.error('Erro ao importar lote:', error);
    } else {
      success += batch.length;
    }
    
    if (onProgress) {
      onProgress(Math.min(i + batchSize, records.length), records.length);
    }
  }
  
  return { success, errors, messages };
}
