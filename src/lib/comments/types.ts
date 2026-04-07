export const MAX_COMMENT_LENGTH = 1000;

export interface ListingComment {
  id: string;
  listing_id: string;
  user_id: string | null;
  content: string;
  created_at: string;
  author_name: string | null;
  author_avatar_url: string | null;
  author_is_seller: boolean;
}
