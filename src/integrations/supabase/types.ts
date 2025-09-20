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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      campaign_knowledge: {
        Row: {
          content: string
          created_at: string
          generated_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          generated_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          generated_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      campaign_scripts: {
        Row: {
          assunto_email: string
          call_made: boolean | null
          campaign_id: string
          created_at: string
          email_sent: boolean | null
          empresa: string
          id: string
          modelo_email: string
          roteiro_ligacao: string
          status: string
          updated_at: string
          whatsapp_sent: boolean | null
        }
        Insert: {
          assunto_email: string
          call_made?: boolean | null
          campaign_id: string
          created_at?: string
          email_sent?: boolean | null
          empresa: string
          id?: string
          modelo_email: string
          roteiro_ligacao: string
          status?: string
          updated_at?: string
          whatsapp_sent?: boolean | null
        }
        Update: {
          assunto_email?: string
          call_made?: boolean | null
          campaign_id?: string
          created_at?: string
          email_sent?: boolean | null
          empresa?: string
          id?: string
          modelo_email?: string
          roteiro_ligacao?: string
          status?: string
          updated_at?: string
          whatsapp_sent?: boolean | null
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
          status: string
          target_companies: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          target_companies?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          target_companies?: string[]
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
      interactions: {
        Row: {
          assunto: string | null
          contact_id: string | null
          created_at: string
          data_interacao: string | null
          descricao: string | null
          id: string
          proximo_followup: string | null
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assunto?: string | null
          contact_id?: string | null
          created_at?: string
          data_interacao?: string | null
          descricao?: string | null
          id?: string
          proximo_followup?: string | null
          tipo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assunto?: string | null
          contact_id?: string | null
          created_at?: string
          data_interacao?: string | null
          descricao?: string | null
          id?: string
          proximo_followup?: string | null
          tipo?: string
          updated_at?: string
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
        ]
      }
      leads: {
        Row: {
          approach_strategy: string | null
          best_contact_time: string | null
          cnae: string | null
          contato_decisor: string | null
          created_at: string
          email: string | null
          empresa: string
          estimated_revenue: string | null
          gancho_prospeccao: string | null
          id: string
          notes: string | null
          qualification_score: string | null
          regime_tributario: string | null
          setor: string | null
          status: string | null
          telefone: string | null
          updated_at: string
          urgency_level: string | null
          user_id: string
          website: string | null
        }
        Insert: {
          approach_strategy?: string | null
          best_contact_time?: string | null
          cnae?: string | null
          contato_decisor?: string | null
          created_at?: string
          email?: string | null
          empresa: string
          estimated_revenue?: string | null
          gancho_prospeccao?: string | null
          id?: string
          notes?: string | null
          qualification_score?: string | null
          regime_tributario?: string | null
          setor?: string | null
          status?: string | null
          telefone?: string | null
          updated_at?: string
          urgency_level?: string | null
          user_id: string
          website?: string | null
        }
        Update: {
          approach_strategy?: string | null
          best_contact_time?: string | null
          cnae?: string | null
          contato_decisor?: string | null
          created_at?: string
          email?: string | null
          empresa?: string
          estimated_revenue?: string | null
          gancho_prospeccao?: string | null
          id?: string
          notes?: string | null
          qualification_score?: string | null
          regime_tributario?: string | null
          setor?: string | null
          status?: string | null
          telefone?: string | null
          updated_at?: string
          urgency_level?: string | null
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          contato_id: string | null
          created_at: string
          data_fechamento_esperada: string | null
          empresa: string
          estagio: string | null
          id: string
          observacoes: string | null
          probabilidade: number | null
          titulo: string
          updated_at: string
          user_id: string
          valor: number | null
        }
        Insert: {
          contato_id?: string | null
          created_at?: string
          data_fechamento_esperada?: string | null
          empresa: string
          estagio?: string | null
          id?: string
          observacoes?: string | null
          probabilidade?: number | null
          titulo: string
          updated_at?: string
          user_id: string
          valor?: number | null
        }
        Update: {
          contato_id?: string | null
          created_at?: string
          data_fechamento_esperada?: string | null
          empresa?: string
          estagio?: string | null
          id?: string
          observacoes?: string | null
          probabilidade?: number | null
          titulo?: string
          updated_at?: string
          user_id?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          display_name: string | null
          id: string
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scheduled_meetings: {
        Row: {
          created_at: string | null
          duration_minutes: number | null
          id: string
          lead_email: string
          lead_id: string | null
          lead_name: string
          meeting_type: string | null
          notes: string | null
          scheduled_date: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          lead_email: string
          lead_id?: string | null
          lead_name: string
          meeting_type?: string | null
          notes?: string | null
          scheduled_date: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          lead_email?: string
          lead_id?: string | null
          lead_name?: string
          meeting_type?: string | null
          notes?: string | null
          scheduled_date?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_config: {
        Row: {
          api_token: string | null
          created_at: string
          id: string
          is_active: boolean | null
          phone_number: string | null
          updated_at: string
          user_id: string
          webhook_url: string | null
        }
        Insert: {
          api_token?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          phone_number?: string | null
          updated_at?: string
          user_id: string
          webhook_url?: string | null
        }
        Update: {
          api_token?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          phone_number?: string | null
          updated_at?: string
          user_id?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          created_at: string
          id: string
          message_content: string
          message_type: string | null
          phone_number: string
          processed: boolean | null
          response_sent: boolean | null
          sender_name: string | null
          timestamp: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_content: string
          message_type?: string | null
          phone_number: string
          processed?: boolean | null
          response_sent?: boolean | null
          sender_name?: string | null
          timestamp?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_content?: string
          message_type?: string | null
          phone_number?: string
          processed?: boolean | null
          response_sent?: boolean | null
          sender_name?: string | null
          timestamp?: string
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
