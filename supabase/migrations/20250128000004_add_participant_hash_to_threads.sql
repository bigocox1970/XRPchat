-- Add participant_hash column with unique constraint
ALTER TABLE public.threads
ADD COLUMN participant_hash TEXT;

-- Create unique index
CREATE UNIQUE INDEX threads_participant_hash_idx ON public.threads (participant_hash);

-- Backfill existing threads with their participant hash
UPDATE public.threads
SET participant_hash = encode(sha256(convert_to(array_to_string(participant_ids, ','), 'UTF8')), 'hex');

-- Set column to NOT NULL after backfilling
ALTER TABLE public.threads
ALTER COLUMN participant_hash SET NOT NULL;
