-- Add PIN-related columns to wallets table
ALTER TABLE public.wallets ADD COLUMN pin_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.wallets ADD COLUMN pin_last_updated TIMESTAMP WITH TIME ZONE;

-- Comment on new columns
COMMENT ON COLUMN public.wallets.pin_enabled IS 'Flag indicating if the private key is encrypted with a PIN';
COMMENT ON COLUMN public.wallets.pin_last_updated IS 'Timestamp when the PIN was last updated'; 