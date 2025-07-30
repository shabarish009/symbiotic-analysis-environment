/**
 * Memory System Types
 * TypeScript definitions for Project Cortex memory system
 */

export interface SchemaInfo {
  schema_name: string;
  table_name: string;
  columns: Record<string, ColumnInfo>;
  relationships: Relationship[];
  indexes: Index[];
  constraints: Constraint[];
  last_updated: number;
  metadata: Record<string, any>;
}

export interface ColumnInfo {
  type: string;
  nullable?: boolean;
  primary_key?: boolean;
  unique?: boolean;
  default?: string;
  description?: string;
}

export interface Relationship {
  type: 'foreign_key' | 'one_to_many' | 'many_to_many';
  column: string;
  references: string;
  on_delete?: 'CASCADE' | 'SET_NULL' | 'RESTRICT';
  on_update?: 'CASCADE' | 'SET_NULL' | 'RESTRICT';
}

export interface Index {
  name: string;
  columns: string[];
  unique: boolean;
  type?: 'btree' | 'hash' | 'gin' | 'gist';
}

export interface Constraint {
  name: string;
  type: 'check' | 'unique' | 'foreign_key' | 'primary_key';
  definition: string;
}

export interface QueryHistoryEntry {
  id?: number;
  project_id: string;
  query_text: string;
  query_hash: string;
  context: Record<string, any>;
  consensus_result: Record<string, any>;
  success_score: number;
  execution_time: number;
  timestamp: number;
  user_feedback?: number; // -1, 0, 1 for negative, neutral, positive
  metadata: Record<string, any>;
}

export interface LearnedPattern {
  id?: number;
  project_id: string;
  pattern_type: PatternType;
  pattern_data: Record<string, any>;
  confidence: number;
  usage_count: number;
  last_used: number;
  created_at: number;
  metadata: Record<string, any>;
}

export enum PatternType {
  QUERY_TEMPLATE = 'query_template',
  USER_PREFERENCE = 'user_preference',
  SCHEMA_USAGE = 'schema_usage',
  QUERY_SIMILARITY = 'query_similarity',
  SUCCESS_PATTERN = 'success_pattern'
}

export interface MemoryContext {
  relevant_schemas: SchemaInfo[];
  similar_queries: QueryHistoryEntry[];
  learned_patterns: LearnedPattern[];
  user_preferences: Record<string, any>;
  context_score: number;
  retrieval_time: number;
  cache_hit: boolean;
  metadata: Record<string, any>;
}

export interface MemoryStats {
  project_count: number;
  schema_count: number;
  query_count: number;
  pattern_count: number;
  cache_hit_rate: number;
  avg_retrieval_time: number;
  database_size_mb: number;
  last_cleanup: number;
  health_status: MemoryStatus;
}

export enum MemoryStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  PARTIAL = 'partial',
  CORRUPTED = 'corrupted',
  RECOVERING = 'recovering'
}

export interface ProjectInfo {
  id: string;
  name: string;
  created_at: number;
  last_accessed: number;
  metadata: Record<string, any>;
}

export interface SchemaSuggestion {
  type: 'table' | 'column' | 'function' | 'keyword';
  value: string;
  schema?: string;
  table?: string;
  data_type?: string;
  description: string;
  confidence?: number;
}

export interface QueryHistoryFilters {
  success_score_min?: number;
  success_score_max?: number;
  date_from?: string;
  date_to?: string;
  query_type?: string;
  has_user_feedback?: boolean;
}

// Memory API Response Types
export interface MemoryContextResponse {
  success: boolean;
  context?: MemoryContext;
  error?: string;
}

export interface MemoryStatsResponse {
  success: boolean;
  statistics?: MemoryStats;
  error?: string;
}

export interface QueryHistoryResponse {
  success: boolean;
  history?: QueryHistoryEntry[];
  error?: string;
}

export interface SchemaSuggestionsResponse {
  success: boolean;
  suggestions?: SchemaSuggestion[];
  error?: string;
}

export interface ProjectResponse {
  success: boolean;
  project?: ProjectInfo;
  error?: string;
}

// Memory Service Interface
export interface MemoryService {
  getContext(query: string, projectId: string): Promise<MemoryContextResponse>;
  getStatistics(projectId?: string): Promise<MemoryStatsResponse>;
  getQueryHistory(projectId: string, limit?: number, filters?: QueryHistoryFilters): Promise<QueryHistoryResponse>;
  getSchemaSuggestions(projectId: string, partialQuery: string): Promise<SchemaSuggestionsResponse>;
  createProject(projectId: string, name: string, metadata?: Record<string, any>): Promise<ProjectResponse>;
  storeSchemaInfo(projectId: string, schemaInfo: SchemaInfo): Promise<{ success: boolean; error?: string }>;
}

// Memory Events
export interface MemoryEvent {
  type: 'context_updated' | 'schema_changed' | 'pattern_learned' | 'query_stored';
  project_id: string;
  data: any;
  timestamp: number;
}

// Memory Configuration
export interface MemoryConfig {
  cache_enabled: boolean;
  cache_size: number;
  cache_ttl: number;
  auto_learning: boolean;
  pattern_confidence_threshold: number;
  query_retention_days: number;
}

// UI Component Props
export interface ProjectCortexPanelProps {
  projectId: string;
  isVisible: boolean;
  onToggleVisibility: () => void;
  config?: MemoryConfig;
}

export interface SchemaExplorerProps {
  projectId: string;
  schemas: SchemaInfo[];
  onSchemaSelect?: (schema: SchemaInfo) => void;
  searchQuery?: string;
}

export interface QueryHistoryViewProps {
  projectId: string;
  history: QueryHistoryEntry[];
  onQuerySelect?: (query: QueryHistoryEntry) => void;
  filters?: QueryHistoryFilters;
  onFiltersChange?: (filters: QueryHistoryFilters) => void;
}

export interface LearnedPatternsViewProps {
  projectId: string;
  patterns: LearnedPattern[];
  onPatternSelect?: (pattern: LearnedPattern) => void;
  patternType?: PatternType;
}

export interface MemoryInsightsProps {
  projectId: string;
  stats: MemoryStats;
  context?: MemoryContext;
}

// Utility Types
export type MemoryOperationResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
};

export interface MemoryHook {
  context: MemoryContext | null;
  stats: MemoryStats | null;
  history: QueryHistoryEntry[];
  suggestions: SchemaSuggestion[];
  loading: boolean;
  error: string | null;
  
  // Actions
  getContext: (query: string) => Promise<void>;
  getStats: () => Promise<void>;
  getHistory: (limit?: number) => Promise<void>;
  getSuggestions: (partialQuery: string) => Promise<void>;
  createProject: (name: string, metadata?: Record<string, any>) => Promise<void>;
  storeSchema: (schemaInfo: SchemaInfo) => Promise<void>;
}
