export interface Gallery {
  id:         string;
  master_id:  string;
  photo_url:  string;
  caption:    string | null;
  sort_order: number;
  created_at: Date;
}

export interface CreateGalleryInput {
  master_id: string;
  photo_url: string;
  caption?:  string | null;
}
