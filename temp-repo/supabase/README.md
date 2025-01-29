# Supabase Setup and Management

This directory contains all Supabase-related configuration and migrations for the secure chat application.

## Directory Structure

```
supabase/
├── migrations/         # Database migrations
│   └── 20250128000000_initial_setup.sql  # Initial schema
├── config.toml        # Supabase configuration
└── seed.sql          # Test data
```

## Initial Setup

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Login to Supabase:
```bash
supabase login
```

3. Initialize local development:
```bash
supabase start
```

4. Link to your project:
```bash
supabase link --project-ref your-project-ref
```

## Database Setup

1. Apply migrations:
```bash
supabase db reset
```

This will:
- Reset the database to a clean state
- Run all migrations in order
- Apply the seed data

## Development Workflow

1. Start local development:
```bash
supabase start
```

2. Create a new migration:
```bash
supabase migration new my_migration_name
```

3. Test locally:
```bash
supabase db reset
```

4. Push to production:
```bash
supabase db push
```

## Type Generation

After schema changes, update TypeScript types:

```bash
supabase gen types typescript --local > ../src/types/supabase.ts
```

## Common Tasks

### Reset Database
```bash
supabase db reset
```

### View Migration Status
```bash
supabase migration list
```

### Generate Migration from Changes
```bash
supabase db diff -f my_migration_name
```

### Verify Setup
```bash
supabase status
```

## Troubleshooting

### Migration Failed
```bash
# View logs
supabase migration repair

# Reset status
supabase migration repair --status reverted
```

### Database Connection Issues
```bash
# Restart services
supabase stop
supabase start
```

### Type Generation Failed
```bash
# Force regenerate
supabase gen types typescript --local --force
```

## Security Notes

1. Never commit sensitive data:
   - API keys
   - Passwords
   - Private keys

2. Always test RLS policies:
```sql
-- Test as authenticated user
set request.jwt.claim.sub='test-user-id';
select * from messages;

-- Test as anonymous
set request.jwt.claim.sub='';
select * from messages;
```

3. Backup before major changes:
```bash
supabase db dump -f backup.sql
```

## Production Deployment

1. Always test migrations locally first
2. Backup production database
3. Apply migrations during low-traffic periods
4. Monitor logs for errors
5. Have rollback plan ready

## Monitoring

1. Check database health:
```bash
supabase db check
```

2. View slow queries:
```sql
select * from pg_stat_statements
order by mean_exec_time desc
limit 10;
```

3. Monitor table sizes:
```sql
select
  schemaname as table_schema,
  relname as table_name,
  pg_size_pretty(pg_total_relation_size(relid)) as total_size
from pg_catalog.pg_statio_user_tables
order by pg_total_relation_size(relid) desc;
```

## Best Practices

1. **Migrations**
   - One change per migration
   - Include both up and down migrations
   - Test migrations locally
   - Use descriptive names

2. **RLS Policies**
   - Always enable RLS
   - Test all policies
   - Document policy purposes
   - Keep policies simple

3. **Performance**
   - Create necessary indexes
   - Monitor query performance
   - Use appropriate data types
   - Regular maintenance

4. **Backup**
   - Regular backups
   - Test restore process
   - Document recovery procedures

## Support

For issues:
1. Check Supabase logs
2. Review migration history
3. Check RLS policies
4. Verify environment variables
