# Supabase Management Guide

This guide explains how to manage Supabase using the CLI for automated database changes.

## Supabase CLI Setup

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Login to Supabase:
```bash
supabase login
```

3. Initialize Supabase in project:
```bash
supabase init
```

4. Link to your Supabase project:
```bash
supabase link --project-ref your-project-ref
```

## Project Structure

```
supabase/
├── migrations/         # Database migrations
├── functions/         # Edge functions
├── config.toml        # Configuration file
└── seed.sql          # Seed data
```

## Managing Database Changes

### Creating Migrations

1. Start local development:
```bash
supabase start
```

2. Create a new migration:
```bash
supabase migration new create_initial_tables
```

This creates a new timestamped SQL file in `supabase/migrations/`.

3. Add your SQL to the migration file:
```sql
-- Example migration file
create table public.profiles (
  id uuid references auth.users primary key,
  username text unique not null,
  avatar_url text,
  wallet_address text unique not null,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Add policies
alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using ( true );
```

### Applying Migrations

1. Local development:
```bash
supabase db reset        # Reset local database
supabase migration up    # Apply pending migrations
```

2. Production:
```bash
supabase db push        # Push migrations to production
```

## Type Generation

Generate TypeScript types from your database schema:

```bash
supabase gen types typescript --local > src/types/supabase.ts
```

## Database Backups

1. Create backup:
```bash
supabase db dump -f backup.sql
```

2. Restore from backup:
```bash
supabase db reset --db-url="postgres://postgres:postgres@localhost:54322/postgres"
```

## Continuous Integration

Example GitHub Actions workflow:

```yaml
name: Deploy Migrations
on:
  push:
    branches: [main]
    paths:
      - 'supabase/migrations/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: supabase/setup-cli@v1
      - run: |
          supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_ID }}
          supabase db push
```

## Best Practices

1. **Version Control**
   - Always commit migration files
   - Never modify existing migrations
   - Create new migrations for changes

2. **Migration Naming**
   ```
   [timestamp]_descriptive_name.sql
   ```
   Example: `20250128000000_create_profiles_table.sql`

3. **Testing Migrations**
   ```bash
   # Test locally first
   supabase start
   supabase db reset
   supabase migration up
   ```

4. **Rollback Plans**
   - Include `down.sql` for each migration
   - Test rollbacks locally
   ```bash
   supabase migration down -n 1
   ```

5. **Production Deployments**
   - Always backup before deploying
   - Use CI/CD for consistent deployments
   - Test migrations in staging first

## Common Commands

```bash
# Start Supabase locally
supabase start

# Stop Supabase
supabase stop

# Generate types
supabase gen types typescript --local > src/types/supabase.ts

# Create new migration
supabase migration new my_migration_name

# Apply migrations
supabase db push

# Reset local database
supabase db reset

# View migration status
supabase migration list

# Generate migration from diff
supabase db diff -f my_migration_name
```

## Environment Setup

Create `.env` file with Supabase credentials:

```env
SUPABASE_PROJECT_ID=your-project-id
SUPABASE_DB_PASSWORD=your-db-password
SUPABASE_ACCESS_TOKEN=your-access-token
```

## Troubleshooting

1. **Migration Failed**
   ```bash
   # View detailed logs
   supabase migration repair
   
   # Reset migration status
   supabase migration repair --status reverted
   ```

2. **Type Generation Failed**
   ```bash
   # Force regenerate types
   supabase gen types typescript --local --force
   ```

3. **Database Connection Issues**
   ```bash
   # Check status
   supabase status
   
   # Restart services
   supabase stop
   supabase start
   ```

## Security Considerations

1. **Access Control**
   - Always enable RLS
   - Test policies thoroughly
   - Use security definer functions carefully

2. **Sensitive Data**
   - Never commit credentials
   - Use environment variables
   - Encrypt sensitive columns

3. **Backups**
   - Regular automated backups
   - Test restore procedures
   - Secure backup storage

## Monitoring

1. **Database Health**
   ```bash
   supabase db check
   ```

2. **Migration Status**
   ```bash
   supabase migration list
   ```

3. **Performance**
   ```sql
   -- Monitor slow queries
   SELECT * FROM pg_stat_statements
   ORDER BY mean_exec_time DESC
   LIMIT 10;
   ```

This setup allows for:
- Version-controlled database changes
- Automated deployments
- Type safety
- Easy rollbacks
- Consistent environments
