export interface Service {
  id:           string;
  master_id:    string;
  name:         string;
  description:  string | null;
  duration_min: number;
  price:        number;
  is_active:    boolean;
  sort_order:   number;
  created_at:   Date;
}

export interface CreateServiceInput {
  name:         string;
  description?: string;
  duration_min: number;
  price:        number;
  sort_order?:  number;
}

export interface UpdateServiceInput {
  name?:         string;
  description?:  string;
  duration_min?: number;
  price?:        number;
  is_active?:    boolean;
  sort_order?:   number;
}
