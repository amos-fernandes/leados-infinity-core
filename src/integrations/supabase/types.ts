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
      contacts: {
        Row: {
          cargo: string | null
          created_at: string
          email: string | null
          empresa: string | null
          id: string
          linkedin: string | null
          nome: string
          status: string | null
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cargo?: string | null
          created_at?: string
          email?: string | null
          empresa?: string | null
          id?: string
          linkedin?: string | null
          nome: string
          status?: string | null
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cargo?: string | null
          created_at?: string
          email?: string | null
          empresa?: string | null
          id?: string
          linkedin?: string | null
          nome?: string
          status?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string
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
      [_ in never]: never
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
