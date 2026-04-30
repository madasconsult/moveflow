// =============================================================================
// MOVE FLOW — Database Types
// Este arquivo é gerado automaticamente pelo Supabase CLI.
// Rode: npm run gen:types
// Não edite manualmente após gerar.
// =============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          email: string
          role: 'admin_faus' | 'consultor_faus' | 'cliente'
          avatar_url: string | null
          client_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          email: string
          role?: 'admin_faus' | 'consultor_faus' | 'cliente'
          avatar_url?: string | null
          client_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          email?: string
          role?: 'admin_faus' | 'consultor_faus' | 'cliente'
          avatar_url?: string | null
          client_id?: string | null
          is_active?: boolean
          updated_at?: string
        }
      }
      clients: {
        Row: {
          id: string
          company_name: string
          client_name: string | null
          business_unit: string | null
          segment: string | null
          contact_email: string | null
          contact_phone: string | null
          notes: string | null
          status: 'active' | 'inactive'
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_name: string
          client_name?: string | null
          business_unit?: string | null
          segment?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          notes?: string | null
          status?: 'active' | 'inactive'
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          company_name?: string
          client_name?: string | null
          business_unit?: string | null
          segment?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          notes?: string | null
          status?: 'active' | 'inactive'
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          client_id: string
          project_name: string
          short_description: string | null
          main_consultant_id: string | null
          start_date: string | null
          planned_end_date: string | null
          status: ProjectStatus
          phase: ProjectPhase
          progress_percentage: number
          strategic_focus: StrategicFocus
          main_objective: string
          complementary_workstreams: string[] | null
          executive_scope: string
          scope_exclusions: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          project_name: string
          short_description?: string | null
          main_consultant_id?: string | null
          start_date?: string | null
          planned_end_date?: string | null
          status?: ProjectStatus
          phase?: ProjectPhase
          progress_percentage?: number
          strategic_focus: StrategicFocus
          main_objective: string
          complementary_workstreams?: string[] | null
          executive_scope: string
          scope_exclusions?: string | null
          created_by?: string | null
        }
        Update: {
          project_name?: string
          short_description?: string | null
          main_consultant_id?: string | null
          start_date?: string | null
          planned_end_date?: string | null
          status?: ProjectStatus
          phase?: ProjectPhase
          progress_percentage?: number
          strategic_focus?: StrategicFocus
          main_objective?: string
          complementary_workstreams?: string[] | null
          executive_scope?: string
          scope_exclusions?: string | null
          updated_at?: string
        }
      }
      project_diagnoses: {
        Row: {
          id: string
          project_id: string
          start_date: string | null
          end_date: string | null
          owner_id: string | null
          executive_summary: string | null
          key_findings: string | null
          initial_hypotheses: string | null
          status: DiagnosisStatus
          visible_to_client: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          start_date?: string | null
          end_date?: string | null
          owner_id?: string | null
          executive_summary?: string | null
          key_findings?: string | null
          initial_hypotheses?: string | null
          status?: DiagnosisStatus
          visible_to_client?: boolean
          created_by?: string | null
        }
        Update: {
          start_date?: string | null
          end_date?: string | null
          owner_id?: string | null
          executive_summary?: string | null
          key_findings?: string | null
          initial_hypotheses?: string | null
          status?: DiagnosisStatus
          visible_to_client?: boolean
          updated_at?: string
        }
      }
      diagnosis_indicators: {
        Row: {
          id: string
          diagnosis_id: string
          project_id: string
          area: string
          indicator_name: string
          unit_of_measure: string | null
          baseline_value: number | null
          rationale: string | null
          notes: string | null
          reference_date: string | null
          priority: ActionPriority
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          diagnosis_id: string
          project_id: string
          area: string
          indicator_name: string
          unit_of_measure?: string | null
          baseline_value?: number | null
          rationale?: string | null
          notes?: string | null
          reference_date?: string | null
          priority?: ActionPriority
          is_active?: boolean
        }
        Update: {
          area?: string
          indicator_name?: string
          unit_of_measure?: string | null
          baseline_value?: number | null
          rationale?: string | null
          notes?: string | null
          reference_date?: string | null
          priority?: ActionPriority
          is_active?: boolean
          updated_at?: string
        }
      }
      rate_assessments: {
        Row: {
          id: string
          project_id: string
          diagnosis_id: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          diagnosis_id: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          is_active?: boolean
          updated_at?: string
        }
      }
      rate_assessment_versions: {
        Row: {
          id: string
          assessment_id: string
          version_number: number
          version_name: string
          assessment_date: string
          profile_type: RateProfileType
          overall_score: number | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          assessment_id: string
          version_number: number
          version_name: string
          assessment_date?: string
          profile_type: RateProfileType
          overall_score?: number | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          version_name?: string
          assessment_date?: string
          profile_type?: RateProfileType
          overall_score?: number | null
          notes?: string | null
          updated_at?: string
        }
      }
      rate_assessment_items: {
        Row: {
          id: string
          version_id: string
          axis: string
          criterion: string
          weight: number
          score: number | null
          weighted_score: number | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          version_id: string
          axis: string
          criterion: string
          weight: number
          score?: number | null
          weighted_score?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          score?: number | null
          weighted_score?: number | null
          notes?: string | null
          updated_at?: string
        }
      }
      actions: {
        Row: {
          id: string
          business_id: string | null
          project_id: string
          title: string
          description: string | null
          assigned_to: string | null
          action_origin: string | null
          fsp_id: string | null
          kpi_id: string | null
          kpi_period_record_id: string | null
          due_date: string | null
          priority: ActionPriority
          status: ActionStatus
          classification: ActionClassification
          completion_date: string | null
          notes: string | null
          related_meeting_id: string | null
          visible_to_client: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id?: string | null
          project_id: string
          title: string
          description?: string | null
          assigned_to?: string | null
          action_origin?: string | null
          fsp_id?: string | null
          kpi_id?: string | null
          kpi_period_record_id?: string | null
          due_date?: string | null
          priority?: ActionPriority
          status?: ActionStatus
          classification?: ActionClassification
          completion_date?: string | null
          notes?: string | null
          related_meeting_id?: string | null
          visible_to_client?: boolean
          created_by?: string | null
        }
        Update: {
          business_id?: string | null
          title?: string
          description?: string | null
          assigned_to?: string | null
          action_origin?: string | null
          fsp_id?: string | null
          kpi_id?: string | null
          kpi_period_record_id?: string | null
          due_date?: string | null
          priority?: ActionPriority
          status?: ActionStatus
          classification?: ActionClassification
          completion_date?: string | null
          notes?: string | null
          visible_to_client?: boolean
          updated_at?: string
        }
      }
      action_steps: {
        Row: {
          id: string
          action_id: string
          title: string
          description: string | null
          status: ActionStatus
          due_date: string | null
          completion_date: string | null
          sort_order: number | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          action_id: string
          title: string
          description?: string | null
          status?: ActionStatus
          due_date?: string | null
          completion_date?: string | null
          sort_order?: number | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          status?: ActionStatus
          due_date?: string | null
          completion_date?: string | null
          sort_order?: number | null
          updated_at?: string
        }
      }
      document_folders: {
        Row: {
          id: string
          project_id: string
          folder_name: string
          parent_folder_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          folder_name: string
          parent_folder_id?: string | null
          created_by?: string | null
        }
        Update: {
          folder_name?: string
          parent_folder_id?: string | null
          updated_at?: string
        }
      }
      meetings: {
        Row: {
          id: string
          project_id: string
          meeting_date: string
          meeting_type: MeetingType
          participants: string[] | null
          agenda: string | null
          executive_summary: string | null
          decisions_made: string | null
          next_steps: string | null
          next_meeting_date: string | null
          main_focus: string | null
          strategic_focus_relation: string | null
          visible_to_client: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          meeting_date: string
          meeting_type?: MeetingType
          participants?: string[] | null
          agenda?: string | null
          executive_summary?: string | null
          decisions_made?: string | null
          next_steps?: string | null
          next_meeting_date?: string | null
          main_focus?: string | null
          strategic_focus_relation?: string | null
          visible_to_client?: boolean
          created_by?: string | null
        }
        Update: {
          meeting_date?: string
          meeting_type?: MeetingType
          participants?: string[] | null
          agenda?: string | null
          executive_summary?: string | null
          decisions_made?: string | null
          next_steps?: string | null
          visible_to_client?: boolean
          updated_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          project_id: string
          folder_id: string | null
          document_name: string
          category: DocumentCategory
          description: string | null
          document_date: string | null
          responsible_id: string | null
          file_url: string | null
          external_link: string | null
          status: DocumentStatus
          visibility: DocumentVisibility
          related_meeting_id: string | null
          related_phase: ProjectPhase | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          folder_id?: string | null
          document_name: string
          category?: DocumentCategory
          description?: string | null
          document_date?: string | null
          responsible_id?: string | null
          file_url?: string | null
          external_link?: string | null
          status?: DocumentStatus
          visibility?: DocumentVisibility
          related_meeting_id?: string | null
          related_phase?: ProjectPhase | null
          created_by?: string | null
        }
        Update: {
          folder_id?: string | null
          document_name?: string
          category?: DocumentCategory
          description?: string | null
          status?: DocumentStatus
          visibility?: DocumentVisibility
          updated_at?: string
        }
      }
      kpis: {
        Row: {
          id: string
          project_id: string
          kpi_name: string
          category: string | null
          description: string | null
          classification: KpiClassification
          unit_of_measure: string | null
          target_value: number | null
          current_value: number | null
          previous_value: number | null
          update_frequency: KpiFrequency
          last_update_date: string | null
          responsible_id: string | null
          reading_type: KpiReadingType
          status: KpiStatus
          trend: KpiTrend | null
          origin_type: KpiOriginType
          diagnosis_indicator_id: string | null
          notes: string | null
          visible_to_client: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          kpi_name: string
          category?: string | null
          description?: string | null
          classification?: KpiClassification
          unit_of_measure?: string | null
          target_value?: number | null
          current_value?: number | null
          previous_value?: number | null
          update_frequency?: KpiFrequency
          last_update_date?: string | null
          responsible_id?: string | null
          reading_type?: KpiReadingType
          status?: KpiStatus
          trend?: KpiTrend | null
          origin_type?: KpiOriginType
          diagnosis_indicator_id?: string | null
          notes?: string | null
          visible_to_client?: boolean
          created_by?: string | null
        }
        Update: {
          kpi_name?: string
          current_value?: number | null
          target_value?: number | null
          previous_value?: number | null
          last_update_date?: string | null
          reading_type?: KpiReadingType
          status?: KpiStatus
          trend?: KpiTrend | null
          origin_type?: KpiOriginType
          diagnosis_indicator_id?: string | null
          visible_to_client?: boolean
          updated_at?: string
        }
      }
      kpi_target_periods: {
        Row: {
          id: string
          kpi_id: string
          period_label: string
          start_date: string
          end_date: string
          planned_target: number
          green_threshold: number
          yellow_threshold: number
          red_threshold: number
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          kpi_id: string
          period_label: string
          start_date: string
          end_date: string
          planned_target: number
          green_threshold: number
          yellow_threshold: number
          red_threshold: number
          notes?: string | null
          is_active?: boolean
        }
        Update: {
          period_label?: string
          start_date?: string
          end_date?: string
          planned_target?: number
          green_threshold?: number
          yellow_threshold?: number
          red_threshold?: number
          notes?: string | null
          is_active?: boolean
          updated_at?: string
        }
      }
      kpi_period_records: {
        Row: {
          id: string
          kpi_id: string
          target_period_id: string
          competence: string
          actual_value: number
          calculated_status: PerformanceStatus
          absolute_deviation: number
          percentage_deviation: number | null
          justification: string | null
          short_analysis: string | null
          recorded_by: string | null
          recorded_at: string
          period_status: KpiPeriodRecordStatus
          updated_at: string
        }
        Insert: {
          id?: string
          kpi_id: string
          target_period_id: string
          competence: string
          actual_value: number
          calculated_status: PerformanceStatus
          absolute_deviation: number
          percentage_deviation?: number | null
          justification?: string | null
          short_analysis?: string | null
          recorded_by?: string | null
          recorded_at?: string
          period_status?: KpiPeriodRecordStatus
        }
        Update: {
          actual_value?: number
          calculated_status?: PerformanceStatus
          absolute_deviation?: number
          percentage_deviation?: number | null
          justification?: string | null
          short_analysis?: string | null
          period_status?: KpiPeriodRecordStatus
          updated_at?: string
        }
      }
      fsps: {
        Row: {
          id: string
          project_id: string
          source_type: FspSourceType
          source_id: string
          kpi_id: string | null
          kpi_period_record_id: string | null
          action_id: string | null
          title: string
          problem_statement: string
          impact: string | null
          evidence: string | null
          method_type: FspMethodType
          root_cause: string | null
          probable_cause: string | null
          recommendation: string | null
          owner_id: string | null
          status: FspStatus
          opened_at: string
          closed_at: string | null
          linked_action_id: string | null
          generated_action_id: string | null
          why_1: string | null
          why_2: string | null
          why_3: string | null
          why_4: string | null
          why_5: string | null
          five_whys_conclusion: string | null
          ishikawa_method: string | null
          ishikawa_labor: string | null
          ishikawa_machine: string | null
          ishikawa_material: string | null
          ishikawa_measurement: string | null
          ishikawa_environment: string | null
          ishikawa_additional_notes: string | null
          ishikawa_conclusion: string | null
          structured_observed_problem: string | null
          structured_effect_impact: string | null
          structured_cause_hypothesis: string | null
          structured_evidence_notes: string | null
          structured_probable_cause: string | null
          structured_root_cause: string | null
          structured_recommendation: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          source_type: FspSourceType
          source_id: string
          kpi_id?: string | null
          kpi_period_record_id?: string | null
          action_id?: string | null
          title: string
          problem_statement: string
          impact?: string | null
          evidence?: string | null
          method_type?: FspMethodType
          root_cause?: string | null
          probable_cause?: string | null
          recommendation?: string | null
          owner_id?: string | null
          status?: FspStatus
          opened_at?: string
          closed_at?: string | null
          linked_action_id?: string | null
          generated_action_id?: string | null
          why_1?: string | null
          why_2?: string | null
          why_3?: string | null
          why_4?: string | null
          why_5?: string | null
          five_whys_conclusion?: string | null
          ishikawa_method?: string | null
          ishikawa_labor?: string | null
          ishikawa_machine?: string | null
          ishikawa_material?: string | null
          ishikawa_measurement?: string | null
          ishikawa_environment?: string | null
          ishikawa_additional_notes?: string | null
          ishikawa_conclusion?: string | null
          structured_observed_problem?: string | null
          structured_effect_impact?: string | null
          structured_cause_hypothesis?: string | null
          structured_evidence_notes?: string | null
          structured_probable_cause?: string | null
          structured_root_cause?: string | null
          structured_recommendation?: string | null
          created_by?: string | null
        }
        Update: {
          title?: string
          problem_statement?: string
          impact?: string | null
          evidence?: string | null
          method_type?: FspMethodType
          root_cause?: string | null
          probable_cause?: string | null
          recommendation?: string | null
          owner_id?: string | null
          status?: FspStatus
          closed_at?: string | null
          linked_action_id?: string | null
          generated_action_id?: string | null
          why_1?: string | null
          why_2?: string | null
          why_3?: string | null
          why_4?: string | null
          why_5?: string | null
          five_whys_conclusion?: string | null
          ishikawa_method?: string | null
          ishikawa_labor?: string | null
          ishikawa_machine?: string | null
          ishikawa_material?: string | null
          ishikawa_measurement?: string | null
          ishikawa_environment?: string | null
          ishikawa_additional_notes?: string | null
          ishikawa_conclusion?: string | null
          structured_observed_problem?: string | null
          structured_effect_impact?: string | null
          structured_cause_hypothesis?: string | null
          structured_evidence_notes?: string | null
          structured_probable_cause?: string | null
          structured_root_cause?: string | null
          structured_recommendation?: string | null
          updated_at?: string
        }
      }
      kpi_records: {
        Row: {
          id: string
          kpi_id: string
          value: number
          recorded_at: string
          note: string | null
          recorded_by: string | null
        }
        Insert: {
          id?: string
          kpi_id: string
          value: number
          recorded_at?: string
          note?: string | null
          recorded_by?: string | null
        }
        Update: {
          note?: string | null
        }
      }
      timeline_events: {
        Row: {
          id: string
          project_id: string
          event_type: TimelineEventType
          title: string
          description: string | null
          entity_type: TimelineEntityType | null
          entity_id: string | null
          triggered_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          event_type: TimelineEventType
          title: string
          description?: string | null
          entity_type?: TimelineEntityType | null
          entity_id?: string | null
          triggered_by?: string | null
          created_at?: string
        }
        Update: never
      }
      project_members: {
        Row: {
          id: string
          project_id: string
          user_id: string
          role_in_project: ProjectMemberRole
          added_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          role_in_project: ProjectMemberRole
          added_by?: string | null
          created_at?: string
        }
        Update: {
          role_in_project?: ProjectMemberRole
        }
      }
    }
    Enums: {
      user_role: UserRole
      client_status: ClientStatus
      project_status: ProjectStatus
      project_phase: ProjectPhase
      strategic_focus: StrategicFocus
      project_member_role: ProjectMemberRole
      rate_profile_type: RateProfileType
      action_status: ActionStatus
      action_priority: ActionPriority
      action_classification: ActionClassification
      meeting_type: MeetingType
      document_category: DocumentCategory
      document_status: DocumentStatus
      document_visibility: DocumentVisibility
      diagnosis_status: DiagnosisStatus
      kpi_classification: KpiClassification
      kpi_frequency: KpiFrequency
      kpi_origin_type: KpiOriginType
      kpi_period_record_status: KpiPeriodRecordStatus
      kpi_reading_type: KpiReadingType
      kpi_status: KpiStatus
      kpi_trend: KpiTrend
      performance_status: PerformanceStatus
      timeline_event_type: TimelineEventType
      timeline_entity_type: TimelineEntityType
    }
  }
}

// =============================================================================
// Tipos derivados — use estes nos componentes, não Database diretamente
// =============================================================================

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type InsertDto<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type UpdateDto<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

// Entidades principais
export type Profile         = Tables<'profiles'>
export type Client          = Tables<'clients'>
export type Project         = Tables<'projects'>
export type Action          = Tables<'actions'>
export type ActionStep      = Tables<'action_steps'>
export type Meeting         = Tables<'meetings'>
export type Document        = Tables<'documents'>
export type DocumentFolder  = Tables<'document_folders'>
export type ProjectDiagnosis = Tables<'project_diagnoses'>
export type DiagnosisIndicator = Tables<'diagnosis_indicators'>
export type RateAssessment  = Tables<'rate_assessments'>
export type RateAssessmentVersion = Tables<'rate_assessment_versions'>
export type RateAssessmentItem = Tables<'rate_assessment_items'>
export type Kpi             = Tables<'kpis'>
export type KpiTargetPeriod = Tables<'kpi_target_periods'>
export type KpiPeriodRecord = Tables<'kpi_period_records'>
export type Fsp             = Tables<'fsps'>
export type KpiRecord       = Tables<'kpi_records'>
export type TimelineEvent   = Tables<'timeline_events'>
export type ProjectMember   = Tables<'project_members'>

// Enums como tipos TypeScript
export type UserRole             = 'admin_faus' | 'consultor_faus' | 'cliente'
export type ClientStatus         = 'active' | 'inactive'
export type ProjectStatus        = 'not_started' | 'in_progress' | 'at_risk' | 'delayed' | 'completed' | 'suspended' | 'cancelled'
export type ProjectPhase         = 'initial_deployment' | 'diagnosis' | 'planning' | 'execution' | 'monitoring' | 'consolidation' | 'closed'
export type StrategicFocus       = 'transportes' | 'armazem' | 'estoques' | 'planejamento' | 'planejamento_estrategico' | 'compras' | 'supply_chain_integrado' | 'processos' | 'indicadores_e_gestao' | 'sop_soe' | 'layout_e_enderecamento' | 'produtividade_operacional' | 'comercial'
export type ProjectMemberRole    = 'lead' | 'support' | 'client_viewer'
export type ActionStatus         = 'not_started' | 'in_progress' | 'waiting_client' | 'waiting_faus' | 'completed' | 'overdue' | 'cancelled'
export type ActionPriority       = 'low' | 'medium' | 'high' | 'critical'
export type ActionClassification = 'strategic' | 'complementary' | 'operational_support' | 'out_of_scope'
export type MeetingType          = 'kickoff' | 'followup' | 'executive' | 'operational' | 'kpi_review' | 'closure' | 'extraordinary'
export type DocumentCategory     = 'meeting_minutes' | 'executive_report' | 'diagnosis' | 'action_plan' | 'presentation' | 'kpi_indicator' | 'sop_procedure' | 'technical_doc' | 'support_doc' | 'other'
export type DocumentStatus       = 'draft' | 'published' | 'obsolete' | 'archived'
export type DocumentVisibility   = 'internal' | 'client_and_faus'
export type DiagnosisStatus      = 'em_elaboracao' | 'concluido' | 'revisado'
export type RateProfileType     = 'distribuidor' | 'industria' | 'operador_logistico'
export type KpiClassification    = 'primary' | 'complementary'
export type KpiFrequency         = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'annual'
export type KpiOriginType        = 'diagnostic' | 'project_defined' | 'operational_unfolding' | 'other'
export type KpiReadingType       = 'higher_is_better' | 'lower_is_better' | 'exact_target'
export type KpiPeriodRecordStatus = 'aberto' | 'fechado' | 'revisado'
export type KpiStatus            = 'no_update' | 'updated' | 'at_risk' | 'below_target' | 'on_target' | 'above_target' | 'inactive'
export type KpiTrend             = 'improving' | 'stable' | 'worsening'
export type PerformanceStatus    = 'green' | 'yellow' | 'red'
export type FspSourceType        = 'kpi_period' | 'action'
export type FspMethodType        = 'five_whys' | 'ishikawa' | 'structured_analysis'
export type FspStatus            = 'aberta' | 'em_analise' | 'concluida' | 'convertida_em_acao'
export type TimelineEventType    = 'project_created' | 'phase_changed' | 'status_changed' | 'action_created' | 'action_completed' | 'meeting_registered' | 'document_published' | 'kpi_updated' | 'progress_updated'
export type TimelineEntityType   = 'project' | 'action' | 'meeting' | 'document' | 'kpi'
