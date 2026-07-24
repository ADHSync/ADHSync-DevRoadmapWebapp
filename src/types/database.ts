export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ContentStatus = "planned" | "in_progress" | "done" | "cancelled";
export type ContentVisibility = "draft" | "internal" | "public";
export type ContentHorizon = "short" | "mid" | "long";
export type ContentPriority = "high" | "normal" | "low";
export type TranslationState = "missing" | "auto" | "reviewed";
export type ChangeKind = "added" | "changed" | "fixed" | "removed";

export type Database = {
  public: {
    Tables: {
      roadmap_items: {
        Row: {
          id: string;
          slug: string;
          title_de: string;
          summary_de: string;
          title_en: string | null;
          summary_en: string | null;
          dev_notes: string | null;
          status: ContentStatus;
          visibility: ContentVisibility;
          horizon: ContentHorizon;
          priority: ContentPriority;
          category: string | null;
          sort_order: number;
          completed_at: string | null;
          translation_status: TranslationState;
          source_hash: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title_de: string;
          summary_de: string;
          title_en?: string | null;
          summary_en?: string | null;
          dev_notes?: string | null;
          status?: ContentStatus;
          visibility?: ContentVisibility;
          horizon?: ContentHorizon;
          priority?: ContentPriority;
          category?: string | null;
          sort_order?: number;
          completed_at?: string | null;
          translation_status?: TranslationState;
          source_hash?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title_de?: string;
          summary_de?: string;
          title_en?: string | null;
          summary_en?: string | null;
          dev_notes?: string | null;
          status?: ContentStatus;
          visibility?: ContentVisibility;
          horizon?: ContentHorizon;
          priority?: ContentPriority;
          category?: string | null;
          sort_order?: number;
          completed_at?: string | null;
          translation_status?: TranslationState;
          source_hash?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      changelog_entries: {
        Row: {
          id: string;
          app_version: string;
          released_on: string;
          change_kind: ChangeKind;
          title_de: string;
          body_de: string;
          title_en: string | null;
          body_en: string | null;
          visibility: ContentVisibility;
          roadmap_item_id: string | null;
          sort_order: number;
          translation_status: TranslationState;
          source_hash: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          app_version: string;
          released_on: string;
          change_kind?: ChangeKind;
          title_de: string;
          body_de: string;
          title_en?: string | null;
          body_en?: string | null;
          visibility?: ContentVisibility;
          roadmap_item_id?: string | null;
          sort_order?: number;
          translation_status?: TranslationState;
          source_hash?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          app_version?: string;
          released_on?: string;
          change_kind?: ChangeKind;
          title_de?: string;
          body_de?: string;
          title_en?: string | null;
          body_en?: string | null;
          visibility?: ContentVisibility;
          roadmap_item_id?: string | null;
          sort_order?: number;
          translation_status?: TranslationState;
          source_hash?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "changelog_entries_roadmap_item_id_fkey";
            columns: ["roadmap_item_id"];
            isOneToOne: false;
            referencedRelation: "roadmap_items";
            referencedColumns: ["id"];
          },
        ];
      };
      publications: {
        Row: {
          id: number;
          content_type: "roadmap" | "changelog";
          version: number;
          version_label: string;
          item_count: number;
          payload: Json;
          status: "success" | "failed";
          error_message: string | null;
          published_by: string | null;
          published_at: string;
        };
        Insert: {
          id?: number;
          content_type: "roadmap" | "changelog";
          version: number;
          version_label: string;
          item_count?: number;
          payload: Json;
          status?: "success" | "failed";
          error_message?: string | null;
          published_by?: string | null;
          published_at?: string;
        };
        Update: {
          id?: number;
          content_type?: "roadmap" | "changelog";
          version?: number;
          version_label?: string;
          item_count?: number;
          payload?: Json;
          status?: "success" | "failed";
          error_message?: string | null;
          published_by?: string | null;
          published_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      next_publication_version: {
        Args: {
          content_type: "roadmap" | "changelog";
        };
        Returns: number;
      };
    };
    Enums: {
      content_status: ContentStatus;
      content_visibility: ContentVisibility;
      content_horizon: ContentHorizon;
      content_priority: ContentPriority;
      translation_state: TranslationState;
      change_kind: ChangeKind;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type RoadmapItem = Database["public"]["Tables"]["roadmap_items"]["Row"];
export type RoadmapItemInsert =
  Database["public"]["Tables"]["roadmap_items"]["Insert"];
export type RoadmapItemUpdate =
  Database["public"]["Tables"]["roadmap_items"]["Update"];
export type ChangelogEntry =
  Database["public"]["Tables"]["changelog_entries"]["Row"];
export type ChangelogEntryInsert =
  Database["public"]["Tables"]["changelog_entries"]["Insert"];
export type ChangelogEntryUpdate =
  Database["public"]["Tables"]["changelog_entries"]["Update"];
export type Publication = Database["public"]["Tables"]["publications"]["Row"];
