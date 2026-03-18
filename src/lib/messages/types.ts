export const MAX_MESSAGE_LENGTH = 2000;

export interface Conversation {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  last_message_at: string;
  created_at: string;
  // Joined data
  listing_title?: string;
  listing_thumbnail?: string | null;
  listing_price_cents?: number;
  listing_status?: string;
  other_user_name?: string;
  last_message_content?: string;
  unread_count?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
  // Joined data
  sender_name?: string;
}
