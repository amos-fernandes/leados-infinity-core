export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      campaign_errors: {
        Row: {
          campaign_id: string | null
          created_at: string
          error_message: string
          error_type: string
          id: string
          lead_id: string | null
          metadata: Json | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          error_message: string
          error_type: string
          id?: string
          lead_id?: string | null
          metadata?: Json | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          error_message?: string
          error_type?: string
          id?: string
          lead_id?: string | null
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_errors_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_errors_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_knowledge: {
        Row: {
          campaign_id: string | null
          content: string
          created_at: string
          id: string
          knowledge_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_id?: string | null
          content: string
          created_at?: string
          id?: string
          knowledge_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string | null
          content?: string
          created_at?: string
          id?: string
          knowledge_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_knowledge_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_scripts: {
        Row: {
          assunto_email: string | null
          campaign_id: string
          created_at: string
          email_enviado: boolean | null
          empresa: string
          id: string
          ligacao_feita: boolean | null
          modelo_email: string | null
          roteiro_ligacao: string | null
          whatsapp_enviado: boolean | null
        }
        Insert: {
          assunto_email?: string | null
          campaign_id: string
          created_at?: string
          email_enviado?: boolean | null
          empresa: string
          id?: string
          ligacao_feita?: boolean | null
          modelo_email?: string | null
          roteiro_ligacao?: string | null
          whatsapp_enviado?: boolean | null
        }
        Update: {
          assunto_email?: string | null
          campaign_id?: string
          created_at?: string
          email_enviado?: boolean | null
          empresa?: string
          id?: string
          ligacao_feita?: boolean | null
          modelo_email?: string | null
          roteiro_ligacao?: string | null
          whatsapp_enviado?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_scripts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          status: string | null
          target_companies: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string | null
          target_companies?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string | null
          target_companies?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      compliance_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          legal_basis: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          legal_basis: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          legal_basis?: string
          user_id?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          cargo: string | null
          created_at: string
          email: string | null
          empresa: string | null
          id: string
          linkedin: string | null
          nome: string
          observacoes: string | null
          status: string | null
          telefone: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          cargo?: string | null
          created_at?: string
          email?: string | null
          empresa?: string | null
          id?: string
          linkedin?: string | null
          nome: string
          observacoes?: string | null
          status?: string | null
          telefone?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          cargo?: string | null
          created_at?: string
          email?: string | null
          empresa?: string | null
          id?: string
          linkedin?: string | null
          nome?: string
          observacoes?: string | null
          status?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      conversation_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          message_type: string
          metadata: Json | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          message_type: string
          metadata?: Json | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          message_type?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_companies_stats: {
        Row: {
          created_at: string
          dados_validados: boolean | null
          data_referencia: string
          estado: string
          fonte_dados: string
          id: string
          tem_anomalia: boolean | null
          total_empresas: number
          total_grande: number | null
          total_medio: number | null
          total_mei: number | null
          total_micro: number | null
          total_pequeno: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dados_validados?: boolean | null
          data_referencia: string
          estado: string
          fonte_dados?: string
          id?: string
          tem_anomalia?: boolean | null
          total_empresas?: number
          total_grande?: number | null
          total_medio?: number | null
          total_mei?: number | null
          total_micro?: number | null
          total_pequeno?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dados_validados?: boolean | null
          data_referencia?: string
          estado?: string
          fonte_dados?: string
          id?: string
          tem_anomalia?: boolean | null
          total_empresas?: number
          total_grande?: number | null
          total_medio?: number | null
          total_mei?: number | null
          total_micro?: number | null
          total_pequeno?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_new_companies: {
        Row: {
          anomalia_descricao: string | null
          anomalia_temporal: boolean | null
          atividade_principal_codigo: string | null
          atividade_principal_descricao: string | null
          bairro: string | null
          capital_social: number | null
          cep: string | null
          cidade: string | null
          cnpj: string
          cnpj_raiz: string | null
          codigo_natureza_juridica: string | null
          contato_email: string | null
          contato_telefonico: string | null
          contato_telefonico_tipo: string | null
          created_at: string
          dados_validados: boolean | null
          data_abertura: string
          data_ingestao: string
          data_validacao: string | null
          descricao_natureza_juridica: string | null
          estado: string
          fonte_dados: string
          id: string
          logradouro: string | null
          matriz_filial: string | null
          mei: boolean | null
          nome_fantasia: string | null
          numero: string | null
          porte: string | null
          raw_data: Json | null
          razao_social: string
          situacao_cadastral: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          anomalia_descricao?: string | null
          anomalia_temporal?: boolean | null
          atividade_principal_codigo?: string | null
          atividade_principal_descricao?: string | null
          bairro?: string | null
          capital_social?: number | null
          cep?: string | null
          cidade?: string | null
          cnpj: string
          cnpj_raiz?: string | null
          codigo_natureza_juridica?: string | null
          contato_email?: string | null
          contato_telefonico?: string | null
          contato_telefonico_tipo?: string | null
          created_at?: string
          dados_validados?: boolean | null
          data_abertura: string
          data_ingestao?: string
          data_validacao?: string | null
          descricao_natureza_juridica?: string | null
          estado: string
          fonte_dados?: string
          id?: string
          logradouro?: string | null
          matriz_filial?: string | null
          mei?: boolean | null
          nome_fantasia?: string | null
          numero?: string | null
          porte?: string | null
          raw_data?: Json | null
          razao_social: string
          situacao_cadastral?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          anomalia_descricao?: string | null
          anomalia_temporal?: boolean | null
          atividade_principal_codigo?: string | null
          atividade_principal_descricao?: string | null
          bairro?: string | null
          capital_social?: number | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string
          cnpj_raiz?: string | null
          codigo_natureza_juridica?: string | null
          contato_email?: string | null
          contato_telefonico?: string | null
          contato_telefonico_tipo?: string | null
          created_at?: string
          dados_validados?: boolean | null
          data_abertura?: string
          data_ingestao?: string
          data_validacao?: string | null
          descricao_natureza_juridica?: string | null
          estado?: string
          fonte_dados?: string
          id?: string
          logradouro?: string | null
          matriz_filial?: string | null
          mei?: boolean | null
          nome_fantasia?: string | null
          numero?: string | null
          porte?: string | null
          raw_data?: Json | null
          razao_social?: string
          situacao_cadastral?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      data_source_cache: {
        Row: {
          cache_key: string
          created_at: string
          data: Json
          expires_at: string
          id: string
          source: string
          user_id: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          data: Json
          expires_at?: string
          id?: string
          source: string
          user_id: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          data?: Json
          expires_at?: string
          id?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      evolution_instances: {
        Row: {
          api_key: string
          created_at: string
          id: string
          instance_name: string
          instance_url: string
          is_active: boolean | null
          phone_number: string | null
          qr_code: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          instance_name: string
          instance_url: string
          is_active?: boolean | null
          phone_number?: string | null
          qr_code?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          instance_name?: string
          instance_url?: string
          is_active?: boolean | null
          phone_number?: string | null
          qr_code?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      evolution_messages: {
        Row: {
          created_at: string
          from_me: boolean
          id: string
          instance_id: string
          lead_id: string | null
          media_url: string | null
          message_content: string | null
          message_id: string | null
          message_type: string
          remote_jid: string
          status: string | null
          timestamp: string
          user_id: string
          webhook_data: Json | null
        }
        Insert: {
          created_at?: string
          from_me?: boolean
          id?: string
          instance_id: string
          lead_id?: string | null
          media_url?: string | null
          message_content?: string | null
          message_id?: string | null
          message_type: string
          remote_jid: string
          status?: string | null
          timestamp?: string
          user_id: string
          webhook_data?: Json | null
        }
        Update: {
          created_at?: string
          from_me?: boolean
          id?: string
          instance_id?: string
          lead_id?: string | null
          media_url?: string | null
          message_content?: string | null
          message_id?: string | null
          message_type?: string
          remote_jid?: string
          status?: string | null
          timestamp?: string
          user_id?: string
          webhook_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "evolution_messages_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "evolution_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolution_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      evolution_webhook_logs: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          instance_id: string | null
          payload: Json
          processed: boolean | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          instance_id?: string | null
          payload: Json
          processed?: boolean | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          instance_id?: string | null
          payload?: Json
          processed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "evolution_webhook_logs_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "evolution_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          assunto: string
          contact_id: string | null
          created_at: string
          data_interacao: string | null
          descricao: string | null
          id: string
          lead_id: string | null
          opportunity_id: string | null
          tipo: string
          user_id: string
        }
        Insert: {
          assunto: string
          contact_id?: string | null
          created_at?: string
          data_interacao?: string | null
          descricao?: string | null
          id?: string
          lead_id?: string | null
          opportunity_id?: string | null
          tipo: string
          user_id: string
        }
        Update: {
          assunto?: string
          contact_id?: string | null
          created_at?: string
          data_interacao?: string | null
          descricao?: string | null
          id?: string
          lead_id?: string | null
          opportunity_id?: string | null
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address_validated: string | null
          approach_strategy: string | null
          bant_analysis: Json | null
          bright_data_enriched: boolean | null
          business_type_confirmed: string | null
          capital_social: number | null
          cidade: string | null
          cnae: string | null
          cnae_principal: string | null
          cnpj: string | null
          contato_decisor: string | null
          created_at: string
          data_qualificacao: string | null
          email: string | null
          email_encontrado_automaticamente: boolean | null
          empresa: string
          estimated_employees: number | null
          estimated_revenue: string | null
          gancho_prospeccao: string | null
          google_maps_rating: number | null
          google_maps_reviews: number | null
          google_maps_verified: boolean | null
          id: string
          linkedin: string | null
          next_steps: Json | null
          pontuacao_qualificacao: number | null
          qualification_level: string | null
          qualification_score: string | null
          qualified_at: string | null
          recommended_channel: string | null
          regime_tributario: string | null
          setor: string | null
          social_media: Json | null
          status: string | null
          tech_stack: Json | null
          telefone: string | null
          uf: string | null
          updated_at: string
          user_id: string
          validation_completed_at: string | null
          website: string | null
          website_validated: boolean | null
          whatsapp: string | null
          whatsapp_business: string | null
        }
        Insert: {
          address_validated?: string | null
          approach_strategy?: string | null
          bant_analysis?: Json | null
          bright_data_enriched?: boolean | null
          business_type_confirmed?: string | null
          capital_social?: number | null
          cidade?: string | null
          cnae?: string | null
          cnae_principal?: string | null
          cnpj?: string | null
          contato_decisor?: string | null
          created_at?: string
          data_qualificacao?: string | null
          email?: string | null
          email_encontrado_automaticamente?: boolean | null
          empresa: string
          estimated_employees?: number | null
          estimated_revenue?: string | null
          gancho_prospeccao?: string | null
          google_maps_rating?: number | null
          google_maps_reviews?: number | null
          google_maps_verified?: boolean | null
          id?: string
          linkedin?: string | null
          next_steps?: Json | null
          pontuacao_qualificacao?: number | null
          qualification_level?: string | null
          qualification_score?: string | null
          qualified_at?: string | null
          recommended_channel?: string | null
          regime_tributario?: string | null
          setor?: string | null
          social_media?: Json | null
          status?: string | null
          tech_stack?: Json | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          user_id: string
          validation_completed_at?: string | null
          website?: string | null
          website_validated?: boolean | null
          whatsapp?: string | null
          whatsapp_business?: string | null
        }
        Update: {
          address_validated?: string | null
          approach_strategy?: string | null
          bant_analysis?: Json | null
          bright_data_enriched?: boolean | null
          business_type_confirmed?: string | null
          capital_social?: number | null
          cidade?: string | null
          cnae?: string | null
          cnae_principal?: string | null
          cnpj?: string | null
          contato_decisor?: string | null
          created_at?: string
          data_qualificacao?: string | null
          email?: string | null
          email_encontrado_automaticamente?: boolean | null
          empresa?: string
          estimated_employees?: number | null
          estimated_revenue?: string | null
          gancho_prospeccao?: string | null
          google_maps_rating?: number | null
          google_maps_reviews?: number | null
          google_maps_verified?: boolean | null
          id?: string
          linkedin?: string | null
          next_steps?: Json | null
          pontuacao_qualificacao?: number | null
          qualification_level?: string | null
          qualification_score?: string | null
          qualified_at?: string | null
          recommended_channel?: string | null
          regime_tributario?: string | null
          setor?: string | null
          social_media?: Json | null
          status?: string | null
          tech_stack?: Json | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          user_id?: string
          validation_completed_at?: string | null
          website?: string | null
          website_validated?: boolean | null
          whatsapp?: string | null
          whatsapp_business?: string | null
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          created_at: string
          empresa: string
          estagio: string | null
          id: string
          probabilidade: number | null
          status: string | null
          titulo: string
          updated_at: string
          user_id: string
          valor: number | null
        }
        Insert: {
          created_at?: string
          empresa: string
          estagio?: string | null
          id?: string
          probabilidade?: number | null
          status?: string | null
          titulo: string
          updated_at?: string
          user_id: string
          valor?: number | null
        }
        Update: {
          created_at?: string
          empresa?: string
          estagio?: string | null
          id?: string
          probabilidade?: number | null
          status?: string | null
          titulo?: string
          updated_at?: string
          user_id?: string
          valor?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rfb_companies_cache: {
        Row: {
          atividade_principal: string | null
          capital_social: number | null
          cidade: string | null
          cnpj: string
          cnpj_raiz: string | null
          created_at: string
          dados_completos: Json | null
          data_abertura: string
          estado: string
          id: string
          mei: boolean | null
          natureza_juridica: string | null
          nome_fantasia: string | null
          porte: string | null
          razao_social: string
          situacao_cadastral: string | null
          synced_at: string
        }
        Insert: {
          atividade_principal?: string | null
          capital_social?: number | null
          cidade?: string | null
          cnpj: string
          cnpj_raiz?: string | null
          created_at?: string
          dados_completos?: Json | null
          data_abertura: string
          estado: string
          id?: string
          mei?: boolean | null
          natureza_juridica?: string | null
          nome_fantasia?: string | null
          porte?: string | null
          razao_social: string
          situacao_cadastral?: string | null
          synced_at?: string
        }
        Update: {
          atividade_principal?: string | null
          capital_social?: number | null
          cidade?: string | null
          cnpj?: string
          cnpj_raiz?: string | null
          created_at?: string
          dados_completos?: Json | null
          data_abertura?: string
          estado?: string
          id?: string
          mei?: boolean | null
          natureza_juridica?: string | null
          nome_fantasia?: string | null
          porte?: string | null
          razao_social?: string
          situacao_cadastral?: string | null
          synced_at?: string
        }
        Relationships: []
      }
      rfb_sync_metadata: {
        Row: {
          created_at: string
          dataset_version: string
          error_message: string | null
          file_size_mb: number | null
          id: string
          last_sync: string
          records_count: number | null
          status: string
        }
        Insert: {
          created_at?: string
          dataset_version: string
          error_message?: string | null
          file_size_mb?: number | null
          id?: string
          last_sync?: string
          records_count?: number | null
          status?: string
        }
        Update: {
          created_at?: string
          dataset_version?: string
          error_message?: string | null
          file_size_mb?: number | null
          id?: string
          last_sync?: string
          records_count?: number | null
          status?: string
        }
        Relationships: []
      }
      scheduled_messages: {
        Row: {
          campaign_id: string | null
          created_at: string
          error_message: string | null
          executed_at: string | null
          id: string
          lead_id: string | null
          max_retries: number
          message_content: string
          metadata: Json | null
          phone_number: string
          retry_count: number
          scheduled_time: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          lead_id?: string | null
          max_retries?: number
          message_content: string
          metadata?: Json | null
          phone_number: string
          retry_count?: number
          scheduled_time: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          lead_id?: string | null
          max_retries?: number
          message_content?: string
          metadata?: Json | null
          phone_number?: string
          retry_count?: number
          scheduled_time?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduler_logs: {
        Row: {
          action: string
          campaign_id: string | null
          created_at: string
          details: Json | null
          id: string
          status: string
          user_id: string
        }
        Insert: {
          action: string
          campaign_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          status: string
          user_id: string
        }
        Update: {
          action?: string
          campaign_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_config: {
        Row: {
          access_token: string | null
          business_account_id: string | null
          created_at: string
          id: string
          is_active: boolean | null
          phone_number: string | null
          phone_number_id: string | null
          updated_at: string
          user_id: string
          verify_token: string | null
          webhook_url: string | null
        }
        Insert: {
          access_token?: string | null
          business_account_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          phone_number?: string | null
          phone_number_id?: string | null
          updated_at?: string
          user_id: string
          verify_token?: string | null
          webhook_url?: string | null
        }
        Update: {
          access_token?: string | null
          business_account_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          phone_number?: string | null
          phone_number_id?: string | null
          updated_at?: string
          user_id?: string
          verify_token?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          contact_name: string | null
          contact_phone: string
          created_at: string
          id: string
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_name?: string | null
          contact_phone: string
          created_at?: string
          id?: string
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_name?: string | null
          contact_phone?: string
          created_at?: string
          id?: string
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          created_at: string
          direction: string
          id: string
          message_content: string
          message_type: string | null
          phone_number: string
          processed_at: string | null
          response_sent: boolean | null
          sender_name: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          direction: string
          id?: string
          message_content: string
          message_type?: string | null
          phone_number: string
          processed_at?: string | null
          response_sent?: boolean | null
          sender_name?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          direction?: string
          id?: string
          message_content?: string
          message_type?: string | null
          phone_number?: string
          processed_at?: string | null
          response_sent?: boolean | null
          sender_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      clean_expired_cache: { Args: never; Returns: undefined }
      detect_temporal_anomaly: {
        Args: { abertura_date: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
