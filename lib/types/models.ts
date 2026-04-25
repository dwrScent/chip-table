export interface TableRow {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface TableStateRow {
  id: number;
  table_id: number;
  pot_amount: number;
  updated_at: string;
}

export interface PlayerRow {
  id: number;
  table_id: number;
  name: string;
  normalized_name: string;
  wallet_chips: number;
  is_seated: number;
  created_at: string;
  updated_at: string;
}

export interface ActionLogRow {
  id: number;
  table_id: number;
  player_id: number | null;
  action_type: string;
  message: string;
  meta_json: string | null;
  created_at: string;
}

export interface PublicActionLog {
  id: number;
  actionType: string;
  message: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
}
