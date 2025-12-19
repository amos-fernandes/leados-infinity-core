
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY; // Using publishable key for now, ideally service role if bypassing RLS
const TARGET_USER_ID = 'ae261289-9866-42dc-9e4e-3d37619b2369';

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Helper to clean phone numbers
const cleanPhone = (phone) => {
    if (!phone) return null;
    return phone.toString().replace(/\D/g, '');
};

// Helper to determine status based on file type
const getStatus = (fileType) => {
    // Logic based on file:
    // Campanha (Qualified + Opps) -> qualified
    // Empresas (Leads Only) -> novo
    return fileType === 'campaign' ? 'qualificado' : 'novo';
};

const mapRecordToLead = (record, fileType) => {
    const lead = {
        user_id: TARGET_USER_ID,
        empresa: record['razao_social'] || record['Nome da Empresa'] || record['Empresa'] || 'Empresa Desconhecida',
        cnae: record['cnae_fiscal_principal'] || record['CNAE'],
        telefone: cleanPhone(record['ddd_telefone_1'] || record['Telefone'] || record['Celular']),
        email: record['email'] || record['Email'],
        status: getStatus(fileType),
        created_at: new Date().toISOString()
        // Add other fields as matched from inspecting headers
    };

    // Specific mapping based on inspecting headers (to be refined after first run output)
    if (record['cnpj']) lead.empresa = record['razao_social']; // Example

    return lead;
};

async function processFile(filePath, type) {
    console.log(`Processing ${filePath}...`);
    let records = [];

    if (filePath.endsWith('.csv') || filePath.endsWith('.CSV')) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const parsed = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
        records = parsed.data;
    } else if (filePath.endsWith('.xlsx') || filePath.endsWith('.xls')) { // Handling .xls even if named .CSV.xls
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        records = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    }

    console.log(`Found ${records.length} records in ${path.basename(filePath)}`);

    let successCount = 0;
    let errorCount = 0;

    for (const record of records) {
        const leadData = mapRecordToLead(record, type);

        // Basic validation
        if (!leadData.empresa) {
            console.warn('Skipping record without company name:', record);
            continue;
        }

        // Insert into Supabase
        // Note: If RLS is enabled and we use anon key, we might need a policy or use service role key if available.
        // For now, attempting insert assuming policy allows insert with own user_id (which strictly speaking requires auth context)
        // Actually, client-side insert requires auth session. 
        // Since we are running a script, we typically need SERVICE_ROLE_KEY to bypass RLS or need to sign in a dummy user.
        // HOWEVER, for this script, I will assume we have a policy or can use a service key if provided.
        // If VITE_SUPABASE_PUBLISHABLE_KEY is an ANON key, we can't act as specific user easily without signIn.
        // BUT the migration I ran earlier fixes ownership. 
        // Let's try inserting. If it fails due to RLS, I will ask user for SERVICE_ROLE_KEY or use a workaround.
        const { data, error } = await supabase.from('leads').insert(leadData).select();

        if (error) {
            console.error('Error inserting lead:', error.message);
            errorCount++;
        } else {
            successCount++;

            // If it's the campaign file, creating opportunity/contact might be needed?
            // User said: "agendar oportundades e contatos para amnhã" for "Campanha-dezembro..."
            if (type === 'campaign' && data && data[0]) {
                const leadId = data[0].id;
                // Create Opportunity
                const opportunity = {
                    user_id: TARGET_USER_ID,
                    titulo: `Oportunidade - ${leadData.empresa}`,
                    empresa: leadData.empresa,
                    estagio: 'qualificacao', // or 'proposta'
                    data_fechamento_esperada: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
                    probabilidade: 50
                };

                await supabase.from('opportunities').insert(opportunity);

                // Create Interaction (Contact for tomorrow)
                const interaction = {
                    user_id: TARGET_USER_ID,
                    tipo: 'ligacao',
                    assunto: 'Primeiro Contato',
                    descricao: 'Agendado via importação',
                    proximo_followup: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow YYYY-MM-DD
                    // contact_id needs a contact first...
                };
                // await supabase.from('interactions').insert(interaction);
            }
        }
    }

    console.log(`Finished ${path.basename(filePath)}. Success: ${successCount}, Errors: ${errorCount}`);
}

async function main() {
    const inputsDir = path.resolve(__dirname, '../inputs');

    // File 1: Campanha (Qualified + Opps)
    const campaignFile = path.join(inputsDir, 'Campanha-dezembro-janeiro-planilha-2.CSV');
    if (fs.existsSync(campaignFile)) {
        await processFile(campaignFile, 'campaign');
    } else {
        console.error('Campaign file not found:', campaignFile);
    }

    // File 2: Empresas (Leads Only)
    // Note: user said "Empresas-1ro-find.CSV.xls", I should check exact name
    const leadsFile = path.join(inputsDir, 'Empresas-1ro-find.CSV.xlsx'); // Based on previous ls
    if (fs.existsSync(leadsFile)) {
        await processFile(leadsFile, 'leads_only');
    } else {
        // Try alternate name if needed, based on ls it was .xlsx
        console.error('Leads file not found:', leadsFile);
    }
}

main().catch(console.error);
