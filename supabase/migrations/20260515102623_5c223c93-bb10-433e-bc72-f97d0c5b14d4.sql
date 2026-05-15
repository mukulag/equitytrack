
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS is_mtf boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS margin_contribution numeric,
  ADD COLUMN IF NOT EXISTS entry_charges numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exit_charges numeric NOT NULL DEFAULT 0;

ALTER TABLE public.exits
  ADD COLUMN IF NOT EXISTS charges numeric NOT NULL DEFAULT 0;
