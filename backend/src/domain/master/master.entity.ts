export interface Master {
  id: string;
  telegram_id: number;
  username: string | null;
  full_name: string;
  bio: string | null;
  specialty: string | null;
  category_id: string | null;
  city: string | null;
  avatar_url: string | null;
  promo_text: string | null;
  available_today: boolean;
  rating: number;
  review_count: number;
  bot_username: string | null;
  plan: 'trial' | 'active' | 'expired';
  is_published: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ServicePreview {
  id: string;
  name: string;
  duration_min: number;
  price: number;
}

export interface MasterWithServices extends Master {
  services: ServicePreview[];
}

export interface UpdateMasterInput {
  full_name?: string;
  bio?: string;
  specialty?: string;
  category_id?: string;
  city?: string;
  avatar_url?: string;
  promo_text?: string;
  available_today?: boolean;
  is_published?: boolean;
}
