# SQL Scripts for XRPChat

This directory contains SQL scripts that need to be run on your Supabase project to set up or update the database schema.

## Scripts

### `add_push_notification_column.sql`

This script adds the `push_subscription` column to the `profiles` table, which is required for storing push notification subscriptions.

## How to Run Scripts

1. Log in to your Supabase project dashboard at [app.supabase.io](https://app.supabase.io)
2. Navigate to the SQL Editor
3. Create a new query
4. Copy and paste the contents of the desired SQL script
5. Run the query

## Script Descriptions

### `add_push_notification_column.sql`

This script:
- Checks if the `push_subscription` column exists in the `profiles` table
- Adds the column if it doesn't exist
- Creates an index for faster searches
- Updates the Row Level Security (RLS) policies to grant proper access to the new column

Run this script if you're experiencing errors related to the `push_subscription` column or if you want to enable push notifications in your XRPChat instance.

## Troubleshooting

If you encounter permission errors when running the scripts:
- Make sure you're logged in with an account that has admin privileges
- Check that your Supabase project's database is not in a paused state
- Verify that the tables mentioned in the scripts already exist

## Important Notes

- Always backup your database before running schema-altering scripts
- Scripts are designed to be idempotent (safe to run multiple times)
- Some scripts may take a few seconds to execute on larger databases 