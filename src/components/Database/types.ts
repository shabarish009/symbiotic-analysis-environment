// Frontend types for database connections
export interface DatabaseConnection {
  id: string;
  name: string;
  database_type: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  ssl_enabled: boolean;
  connection_timeout: number;
  max_connections: number;
  created_at: string;
  updated_at: string;
  additional_params: Record<string, string>;
}

export type DatabaseType = 
  | 'PostgreSQL'
  | 'MySQL'
  | 'SQLite'
  | 'SqlServer'
  | 'Oracle';

export type ConnectionStatus = 
  | 'Disconnected'
  | 'Connecting'
  | 'Connected'
  | 'Testing'
  | { Error: string };

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  response_time_ms: number;
  server_version?: string;
  timestamp: string;
}

export interface ConnectionSummary {
  id: string;
  name: string;
  database_type: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  status: ConnectionStatus;
  total_queries: number;
  successful_queries: number;
  failed_queries: number;
  average_response_time_ms: number;
  uptime_seconds: number;
  last_activity: string;
}

export interface ConnectionFormData {
  name: string;
  database_type: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl_enabled: boolean;
  connection_timeout: number;
  max_connections: number;
  additional_params: Record<string, string>;
}

export interface DatabaseTypeInfo {
  type: DatabaseType;
  displayName: string;
  defaultPort: number;
  description: string;
  features: string[];
  icon: string;
}

export interface ConnectionManagerState {
  connections: DatabaseConnection[];
  selectedConnection: string | null;
  isLoading: boolean;
  error: string | null;
  showForm: boolean;
  editingConnection: DatabaseConnection | null;
}

export interface ConnectionFormErrors {
  name?: string;
  host?: string;
  port?: string;
  database?: string;
  username?: string;
  password?: string;
  connection_timeout?: string;
  max_connections?: string;
}

// Database feature flags
export enum DatabaseFeature {
  SSL = 'SSL',
  WindowsAuthentication = 'WindowsAuthentication',
  ConnectionPooling = 'ConnectionPooling',
  Transactions = 'Transactions',
  PreparedStatements = 'PreparedStatements',
  BulkInsert = 'BulkInsert',
  StoredProcedures = 'StoredProcedures',
  Views = 'Views',
  Triggers = 'Triggers',
  FullTextSearch = 'FullTextSearch',
}

// Connection events
export interface ConnectionEvent {
  type: 'connected' | 'disconnected' | 'error' | 'testing';
  connectionId: string;
  timestamp: Date;
  data?: any;
}

// Security audit event
export interface SecurityEvent {
  event_type: string;
  timestamp: string;
  details: string;
  source: string;
}
