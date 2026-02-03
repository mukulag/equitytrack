-- Drop the existing check constraint and add a new one that includes IPO
ALTER TABLE public.trades DROP CONSTRAINT IF EXISTS trades_trade_type_check;
ALTER TABLE public.trades ADD CONSTRAINT trades_trade_type_check CHECK (trade_type IN ('LONG', 'SHORT', 'IPO'));