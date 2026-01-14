export type Event = {
  id: string;
  slug: string;
  name: string;
  date: string;
  passcode?: string;
  created_at: string;
  owner_id?: string;
};

export type Photo = {
  id: string;
  event_id: string;
  storage_path: string;
  caption?: string;
  status: 'pending' | 'approved' | 'rejected';
  uploader_id?: string; // null if anonymous
  created_at: string;
  // Local-only properties for UI
  url?: string; // Signed URL from storage
  file?: File; // For upload queue
};
