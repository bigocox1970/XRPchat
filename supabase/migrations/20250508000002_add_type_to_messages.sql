-- Migration: Add 'type' column to messages table for supporting text and image messages
alter table public.messages add column type text not null default 'text';

-- Optionally, update all existing rows to 'text' (should be default, but for safety)
update public.messages set type = 'text' where type is null; 