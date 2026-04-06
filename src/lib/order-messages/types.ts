export const MAX_ORDER_MESSAGE_LENGTH = 1000;

export interface OrderMessage {
  id: string;
  order_id: string;
  user_id: string | null;
  author_role: 'buyer' | 'seller';
  content: string;
  created_at: string;
  /** Enriched from public_profiles at read time; null for deleted accounts */
  author_name: string | null;
}
