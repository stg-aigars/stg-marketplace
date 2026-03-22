-- Public function to get completed sales count for a seller
-- SECURITY DEFINER bypasses RLS to count orders, but only returns a count (no sensitive data)
CREATE OR REPLACE FUNCTION get_seller_completed_sales(p_seller_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM orders
  WHERE seller_id = p_seller_id
  AND status = 'completed';
$$;

-- Allow anonymous and authenticated users to call this function
GRANT EXECUTE ON FUNCTION get_seller_completed_sales(uuid) TO anon;
GRANT EXECUTE ON FUNCTION get_seller_completed_sales(uuid) TO authenticated;
