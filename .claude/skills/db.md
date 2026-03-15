---
name: db
description: Query the STG Supabase database with natural language
---

# Database Query Skill

When the user asks to query the database, use the Supabase MCP tools.

## Available Operations

1. **Query data**: Use `execute_sql` to run SELECT queries
2. **List tables**: Use `list_tables` to see the schema
3. **Run migrations**: Use `apply_migration` for schema changes
4. **Generate types**: Use `generate_typescript_types` after schema changes

## Safety Rules

- NEVER run DELETE or DROP without explicit user confirmation
- Always use SELECT first to preview what will be affected
- For UPDATE/DELETE, always include a WHERE clause
- Wrap multi-statement changes in a transaction

## Common Queries

### Check order status
```sql
SELECT id, order_number, status, total_amount_cents, created_at
FROM orders
WHERE status = 'pending_seller'
ORDER BY created_at DESC;
```

### Active listings count by country
```sql
SELECT country, COUNT(*) as listing_count
FROM listings
WHERE status = 'active'
GROUP BY country;
```

### User lookup
```sql
SELECT up.id, up.full_name, up.country, up.created_at
FROM user_profiles up
WHERE up.full_name ILIKE '%search_term%';
```

## After Schema Changes

Always regenerate TypeScript types:
```
Use the generate_typescript_types MCP tool
```

Then copy the output to `src/lib/supabase/database.types.ts`.
