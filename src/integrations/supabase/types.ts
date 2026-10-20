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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      courses: {
        Row: {
          capa_url: string | null
          created_at: string
          descricao: string
          descricao_curta: string
          id: string
          preco_centavos: number
          slug: string
          status: Database["public"]["Enums"]["course_status"]
          titulo: string
        }
        Insert: {
          capa_url?: string | null
          created_at?: string
          descricao?: string
          descricao_curta?: string
          id?: string
          preco_centavos?: number
          slug: string
          status?: Database["public"]["Enums"]["course_status"]
          titulo: string
        }
        Update: {
          capa_url?: string | null
          created_at?: string
          descricao?: string
          descricao_curta?: string
          id?: string
          preco_centavos?: number
          slug?: string
          status?: Database["public"]["Enums"]["course_status"]
          titulo?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          course_id: string
          fim: string | null
          id: string
          inicio: string
          origem: string
          status: Database["public"]["Enums"]["enrollment_status"]
          user_id: string
        }
        Insert: {
          course_id: string
          fim?: string | null
          id?: string
          inicio?: string
          origem?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          user_id: string
        }
        Update: {
          course_id?: string
          fim?: string | null
          id?: string
          inicio?: string
          origem?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      gestao_acessos: {
        Row: {
          modulos: string[]
          unidade_id: string
          user_id: string
        }
        Insert: {
          modulos?: string[]
          unidade_id: string
          user_id: string
        }
        Update: {
          modulos?: string[]
          unidade_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gestao_acessos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      gestao_itens: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          colecao: string
          dados: Json
          id: string
          unidade_id: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          colecao: string
          dados: Json
          id: string
          unidade_id: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          colecao?: string
          dados?: Json
          id?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gestao_itens_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_assets: {
        Row: {
          id: string
          lesson_id: string
          ordem: number
          tipo: string
          titulo: string
          url: string
        }
        Insert: {
          id?: string
          lesson_id: string
          ordem?: number
          tipo?: string
          titulo: string
          url: string
        }
        Update: {
          id?: string
          lesson_id?: string
          ordem?: number
          tipo?: string
          titulo?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_assets_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          atualizado_em: string
          concluida: boolean
          id: string
          lesson_id: string
          posicao_seg: number
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          concluida?: boolean
          id?: string
          lesson_id: string
          posicao_seg?: number
          user_id: string
        }
        Update: {
          atualizado_em?: string
          concluida?: boolean
          id?: string
          lesson_id?: string
          posicao_seg?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_questions: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          pergunta: string
          resposta: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          pergunta: string
          resposta?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          pergunta?: string
          resposta?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_questions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_transcripts: {
        Row: {
          atualizado_em: string
          lesson_id: string
          texto: string
        }
        Insert: {
          atualizado_em?: string
          lesson_id: string
          texto?: string
        }
        Update: {
          atualizado_em?: string
          lesson_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_transcripts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: true
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          descricao: string
          duracao_seg: number
          id: string
          is_preview: boolean
          module_id: string
          ordem: number
          titulo: string
          video_path: string | null
        }
        Insert: {
          descricao?: string
          duracao_seg?: number
          id?: string
          is_preview?: boolean
          module_id: string
          ordem?: number
          titulo: string
          video_path?: string | null
        }
        Update: {
          descricao?: string
          duracao_seg?: number
          id?: string
          is_preview?: boolean
          module_id?: string
          ordem?: number
          titulo?: string
          video_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          course_id: string
          id: string
          ordem: number
          titulo: string
        }
        Insert: {
          course_id: string
          id?: string
          ordem?: number
          titulo: string
        }
        Update: {
          course_id?: string
          id?: string
          ordem?: number
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          nome: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id: string
          nome?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      unidades: {
        Row: {
          id: string
          nome: string
          ordem: number
          webposto_empresa: number | null
        }
        Insert: {
          id?: string
          nome: string
          ordem?: number
          webposto_empresa?: number | null
        }
        Update: {
          id?: string
          nome?: string
          ordem?: number
          webposto_empresa?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      rh_importacoes: {
        Row: {
          arquivo: string
          criado_em: string
          feito_por: string | null
          id: string
          periodo_ate: string | null
          periodo_de: string | null
          quantidade: number
          relatorio: string
          unidade_id: string
        }
        Insert: {
          arquivo: string
          criado_em?: string
          feito_por?: string | null
          id?: string
          periodo_ate?: string | null
          periodo_de?: string | null
          quantidade?: number
          relatorio: string
          unidade_id: string
        }
        Update: {
          arquivo?: string
          criado_em?: string
          feito_por?: string | null
          id?: string
          periodo_ate?: string | null
          periodo_de?: string | null
          quantidade?: number
          relatorio?: string
          unidade_id?: string
        }
        Relationships: []
      }
      rh_irregularidades: {
        Row: {
          cargo: string
          colaborador: string
          cpf: string
          data: string
          importacao_id: string | null
          nome: string
          setor: string
          tipo: string
          unidade_id: string
          vinculo: string
        }
        Insert: {
          cargo?: string
          colaborador: string
          cpf?: string
          data: string
          importacao_id?: string | null
          nome: string
          setor?: string
          tipo: string
          unidade_id: string
          vinculo?: string
        }
        Update: {
          cargo?: string
          colaborador?: string
          cpf?: string
          data?: string
          importacao_id?: string | null
          nome?: string
          setor?: string
          tipo?: string
          unidade_id?: string
          vinculo?: string
        }
        Relationships: []
      }
      rh_ponto_dias: {
        Row: {
          batidas: string[]
          colaborador: string
          data: string
          descontos_min: number
          diurna_min: number
          extras100_min: number
          extras_min: number
          folga: boolean
          hn_min: number
          importacao_id: string | null
          jornada: string
          nome: string
          noturna_min: number
          observacao: string
          trabalhou: boolean
          unidade_id: string
        }
        Insert: {
          batidas?: string[]
          colaborador: string
          data: string
          descontos_min?: number
          diurna_min?: number
          extras100_min?: number
          extras_min?: number
          folga?: boolean
          hn_min?: number
          importacao_id?: string | null
          jornada?: string
          nome: string
          noturna_min?: number
          observacao?: string
          trabalhou?: boolean
          unidade_id: string
        }
        Update: {
          batidas?: string[]
          colaborador?: string
          data?: string
          descontos_min?: number
          diurna_min?: number
          extras100_min?: number
          extras_min?: number
          folga?: boolean
          hn_min?: number
          importacao_id?: string | null
          jornada?: string
          nome?: string
          noturna_min?: number
          observacao?: string
          trabalhou?: boolean
          unidade_id?: string
        }
        Relationships: []
      }
      webposto_importacoes: {
        Row: {
          criado_em: string
          data_final: string
          data_inicial: string
          endpoint: string
          erro: string | null
          feito_por: string | null
          id: string
          quantidade: number
          sem_unidade: number
        }
        Insert: {
          criado_em?: string
          data_final: string
          data_inicial: string
          endpoint: string
          erro?: string | null
          feito_por?: string | null
          id?: string
          quantidade?: number
          sem_unidade?: number
        }
        Update: {
          criado_em?: string
          data_final?: string
          data_inicial?: string
          endpoint?: string
          erro?: string | null
          feito_por?: string | null
          id?: string
          quantidade?: number
          sem_unidade?: number
        }
        Relationships: []
      }
      webposto_registros: {
        Row: {
          codigo: string
          dados: Json
          data_ref: string | null
          empresa_codigo: number | null
          endpoint: string
          importado_em: string
          unidade_id: string | null
        }
        Insert: {
          codigo: string
          dados: Json
          data_ref?: string | null
          empresa_codigo?: number | null
          endpoint: string
          importado_em?: string
          unidade_id?: string | null
        }
        Update: {
          codigo?: string
          dados?: Json
          data_ref?: string | null
          empresa_codigo?: number | null
          endpoint?: string
          importado_em?: string
          unidade_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webposto_registros_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_lesson: {
        Args: { _lesson_id: string; _user_id: string }
        Returns: boolean
      }
      has_active_enrollment: {
        Args: { _course_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      lesson_course_id: { Args: { _lesson_id: string }; Returns: string }
      painel_vendas_webposto: {
        Args: { _ate: string; _de: string }
        Returns: {
          colaborador: string
          hora: number | null
          litros: number
          nivel: string
          produto: string | null
          tipo: string | null
          total: number
          unidade_id: string
          vendas: number
        }[]
      }
      rh_gravar_irregularidades: {
        Args: {
          _arquivo: string
          _ate: string
          _de: string
          _linhas: Json
          _unidade: string
        }
        Returns: number
      }
      rh_gravar_ponto: {
        Args: {
          _arquivo: string
          _ate: string
          _de: string
          _dias: Json
          _unidade: string
        }
        Returns: number
      }
      pode_gestao: {
        Args: { _modulo: string; _unidade_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      course_status: "rascunho" | "publicado"
      enrollment_status: "ativa" | "revogada" | "expirada"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      course_status: ["rascunho", "publicado"],
      enrollment_status: ["ativa", "revogada", "expirada"],
    },
  },
} as const
