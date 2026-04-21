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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      boletas_pago: {
        Row: {
          datos_json: Json | null
          email_destino: string | null
          enviada_email: boolean | null
          fecha_emision: string | null
          folio: number | null
          id: string
          numero_boleta: string | null
          pago_id: string
          pdf_url: string | null
        }
        Insert: {
          datos_json?: Json | null
          email_destino?: string | null
          enviada_email?: boolean | null
          fecha_emision?: string | null
          folio?: number | null
          id?: string
          numero_boleta?: string | null
          pago_id: string
          pdf_url?: string | null
        }
        Update: {
          datos_json?: Json | null
          email_destino?: string | null
          enviada_email?: boolean | null
          fecha_emision?: string | null
          folio?: number | null
          id?: string
          numero_boleta?: string | null
          pago_id?: string
          pdf_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "boletas_pago_pago_id_fkey"
            columns: ["pago_id"]
            isOneToOne: true
            referencedRelation: "pagos"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos: {
        Row: {
          created_at: string | null
          estado: string
          id: string
          metadata: Json | null
          monto_clp: number
          monto_uf: number | null
          mp_payment_id: string | null
          mp_preference_id: string | null
          periodo_cobrado: string | null
          suscripcion_id: string
          updated_at: string | null
          valor_uf_usado: number | null
        }
        Insert: {
          created_at?: string | null
          estado?: string
          id?: string
          metadata?: Json | null
          monto_clp?: number
          monto_uf?: number | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          periodo_cobrado?: string | null
          suscripcion_id: string
          updated_at?: string | null
          valor_uf_usado?: number | null
        }
        Update: {
          created_at?: string | null
          estado?: string
          id?: string
          metadata?: Json | null
          monto_clp?: number
          monto_uf?: number | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          periodo_cobrado?: string | null
          suscripcion_id?: string
          updated_at?: string | null
          valor_uf_usado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_suscripcion_id_fkey"
            columns: ["suscripcion_id"]
            isOneToOne: false
            referencedRelation: "suscripciones"
            referencedColumns: ["id"]
          },
        ]
      }
      planes: {
        Row: {
          activo: boolean | null
          created_at: string | null
          descripcion: string | null
          features: Json | null
          id: number
          nombre: string
          slug: string
          uf_cantidad: number
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          descripcion?: string | null
          features?: Json | null
          id?: number
          nombre: string
          slug: string
          uf_cantidad: number
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          descripcion?: string | null
          features?: Json | null
          id?: number
          nombre?: string
          slug?: string
          uf_cantidad?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          id: string
          nombre_completo: string | null
          nombre_negocio: string | null
          suscripcion_activa: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          nombre_completo?: string | null
          nombre_negocio?: string | null
          suscripcion_activa?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          nombre_completo?: string | null
          nombre_negocio?: string | null
          suscripcion_activa?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      suscripciones: {
        Row: {
          bloqueada_en: string | null
          created_at: string | null
          estado: string
          fecha_inicio: string
          fecha_primer_pago: string | null
          id: string
          plan_id: number
          proximo_cobro: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bloqueada_en?: string | null
          created_at?: string | null
          estado?: string
          fecha_inicio?: string
          fecha_primer_pago?: string | null
          id?: string
          plan_id: number
          proximo_cobro?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bloqueada_en?: string | null
          created_at?: string | null
          estado?: string
          fecha_inicio?: string
          fecha_primer_pago?: string | null
          id?: string
          plan_id?: number
          proximo_cobro?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suscripciones_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "planes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suscripciones_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      uf_cache: {
        Row: {
          created_at: string | null
          fecha: string
          fuente: string | null
          id: number
          valor: number
        }
        Insert: {
          created_at?: string | null
          fecha?: string
          fuente?: string | null
          id?: number
          valor: number
        }
        Update: {
          created_at?: string | null
          fecha?: string
          fuente?: string | null
          id?: number
          valor?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bloquear_vencidas: { Args: never; Returns: number }
      buscar_cuenta_por_email: { Args: { email_input: string }; Returns: Json }
      calcular_proximo_cobro: {
        Args: { p_fecha_referencia: string }
        Returns: string
      }
      crear_pago_pendiente: {
        Args: {
          p_plan_slug: string
          p_preference_id: string
          p_user_id: string
        }
        Returns: Json
      }
      get_uf_actual: { Args: never; Returns: number }
      marcar_en_gracia: { Args: never; Returns: number }
      procesar_pago_mp: {
        Args: {
          p_monto_recibido: number
          p_mp_payment_id: string
          p_mp_status: string
          p_preference_id?: string
        }
        Returns: Json
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
