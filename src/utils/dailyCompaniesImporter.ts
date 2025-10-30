import { supabase } from "@/integrations/supabase/client";

interface ParsedCompany {
  cnpj: string;
  razao_social: string;
  data_abertura: string;
  estado: string;
  cnpj_raiz?: string;
  nome_fantasia?: string;
  situacao_cadastral?: string;
  porte?: string;
  mei?: boolean;
  matriz_filial?: string;
  capital_social?: number;
  atividade_principal_codigo?: string;
  atividade_principal_descricao?: string;
  codigo_natureza_juridica?: string;
  descricao_natureza_juridica?: string;
  cidade?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cep?: string;
  contato_telefonico?: string;
  contato_telefonico_tipo?: string;
  contato_email?: string;
}

/**
 * Normaliza CNPJ removendo caracteres especiais
 */
export function normalizeCNPJ(cnpj: string): string {
  return cnpj.replace(/[^\d]/g, '');
}

/**
 * Valida formato de CNPJ
 */
export function isValidCNPJ(cnpj: string): boolean {
  const cleaned = normalizeCNPJ(cnpj);
  return cleaned.length === 14;
}

/**
 * Converte data em formato brasileiro (DD/MM/YYYY) para ISO (YYYY-MM-DD)
 */
export function parseBrazilianDate(dateStr: string): string {
  // Se já está em formato ISO
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateStr;
  }
  
  // Formato DD/MM/YYYY
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  throw new Error(`Formato de data inválido: ${dateStr}`);
}

/**
 * Parse CSV de empresas
 */
export async function parseCompaniesCSV(fileContent: string): Promise<ParsedCompany[]> {
  const lines = fileContent.split('\n').map(line => line.trim()).filter(Boolean);
  
  if (lines.length === 0) {
    throw new Error('Arquivo vazio');
  }

  // Pegar cabeçalho
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  
  // Mapear índices das colunas
  const getColumnIndex = (possibleNames: string[]): number => {
    for (const name of possibleNames) {
      const idx = headers.findIndex(h => h.includes(name));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const columnMap = {
    cnpj: getColumnIndex(['cnpj']),
    cnpj_raiz: getColumnIndex(['cnpj raiz', 'cnpj_raiz']),
    razao_social: getColumnIndex(['razao social', 'razao_social']),
    nome_fantasia: getColumnIndex(['nome fantasia', 'nome_fantasia']),
    data_abertura: getColumnIndex(['data abertura', 'data_abertura']),
    situacao_cadastral: getColumnIndex(['situacao cadastral', 'situacao_cadastral']),
    porte: getColumnIndex(['porte']),
    mei: getColumnIndex(['mei']),
    matriz_filial: getColumnIndex(['matriz filial', 'matriz_filial']),
    capital_social: getColumnIndex(['capital social', 'capital_social']),
    atividade_principal_codigo: getColumnIndex(['atividade principal codigo', 'atividade_principal_codigo']),
    atividade_principal_descricao: getColumnIndex(['atividade principal descricao', 'atividade_principal_descricao']),
    codigo_natureza_juridica: getColumnIndex(['codigo natureza juridica', 'codigo_natureza_juridica']),
    descricao_natureza_juridica: getColumnIndex(['descricao natureza juridica', 'descricao_natureza_juridica']),
    estado: getColumnIndex(['estado', 'uf']),
    cidade: getColumnIndex(['cidade']),
    logradouro: getColumnIndex(['logradouro']),
    numero: getColumnIndex(['numero']),
    bairro: getColumnIndex(['bairro']),
    cep: getColumnIndex(['cep']),
    contato_telefonico: getColumnIndex(['contato telefonico', 'contato_telefonico', 'telefone']),
    contato_telefonico_tipo: getColumnIndex(['contato telefonico tipo', 'contato_telefonico_tipo']),
    contato_email: getColumnIndex(['contato email', 'contato_email', 'email'])
  };

  if (columnMap.cnpj === -1 || columnMap.razao_social === -1 || 
      columnMap.data_abertura === -1 || columnMap.estado === -1) {
    throw new Error('Colunas obrigatórias não encontradas: cnpj, razao_social, data_abertura, estado');
  }

  const companies: ParsedCompany[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    
    try {
      const cnpj = normalizeCNPJ(values[columnMap.cnpj] || '');
      
      if (!isValidCNPJ(cnpj)) {
        console.warn(`CNPJ inválido na linha ${i + 1}: ${values[columnMap.cnpj]}`);
        continue;
      }

      const company: ParsedCompany = {
        cnpj,
        razao_social: values[columnMap.razao_social] || '',
        data_abertura: parseBrazilianDate(values[columnMap.data_abertura] || ''),
        estado: values[columnMap.estado] || '',
        cnpj_raiz: columnMap.cnpj_raiz !== -1 ? values[columnMap.cnpj_raiz] : undefined,
        nome_fantasia: columnMap.nome_fantasia !== -1 ? values[columnMap.nome_fantasia] : undefined,
        situacao_cadastral: columnMap.situacao_cadastral !== -1 ? values[columnMap.situacao_cadastral] : undefined,
        porte: columnMap.porte !== -1 ? values[columnMap.porte] : undefined,
        mei: columnMap.mei !== -1 ? values[columnMap.mei]?.toLowerCase() === 'sim' || values[columnMap.mei]?.toLowerCase() === 'true' : false,
        matriz_filial: columnMap.matriz_filial !== -1 ? values[columnMap.matriz_filial] : undefined,
        capital_social: columnMap.capital_social !== -1 ? parseFloat(values[columnMap.capital_social]?.replace(/[^\d.,]/g, '').replace(',', '.')) : undefined,
        atividade_principal_codigo: columnMap.atividade_principal_codigo !== -1 ? values[columnMap.atividade_principal_codigo] : undefined,
        atividade_principal_descricao: columnMap.atividade_principal_descricao !== -1 ? values[columnMap.atividade_principal_descricao] : undefined,
        codigo_natureza_juridica: columnMap.codigo_natureza_juridica !== -1 ? values[columnMap.codigo_natureza_juridica] : undefined,
        descricao_natureza_juridica: columnMap.descricao_natureza_juridica !== -1 ? values[columnMap.descricao_natureza_juridica] : undefined,
        cidade: columnMap.cidade !== -1 ? values[columnMap.cidade] : undefined,
        logradouro: columnMap.logradouro !== -1 ? values[columnMap.logradouro] : undefined,
        numero: columnMap.numero !== -1 ? values[columnMap.numero] : undefined,
        bairro: columnMap.bairro !== -1 ? values[columnMap.bairro] : undefined,
        cep: columnMap.cep !== -1 ? values[columnMap.cep] : undefined,
        contato_telefonico: columnMap.contato_telefonico !== -1 ? values[columnMap.contato_telefonico] : undefined,
        contato_telefonico_tipo: columnMap.contato_telefonico_tipo !== -1 ? values[columnMap.contato_telefonico_tipo] : undefined,
        contato_email: columnMap.contato_email !== -1 ? values[columnMap.contato_email] : undefined
      };

      companies.push(company);
    } catch (error) {
      console.warn(`Erro ao processar linha ${i + 1}:`, error);
    }
  }

  return companies;
}

/**
 * Importa empresas para o banco via Edge Function
 */
export async function importDailyCompanies(
  companies: ParsedCompany[],
  fonte: string = 'manual',
  dataReferencia?: string,
  onProgress?: (current: number, total: number) => void
): Promise<{ success: number; errors: number; anomalias_temporais: number; messages: string[] }> {
  
  const { data, error } = await supabase.functions.invoke('daily-companies-ingestion', {
    body: {
      companies,
      fonte,
      data_referencia: dataReferencia
    }
  });

  if (error) {
    throw new Error(`Erro na importação: ${error.message}`);
  }

  return data.results;
}
