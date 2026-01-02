-- Create trades table
CREATE TABLE public.trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  trade_type TEXT NOT NULL CHECK (trade_type IN ('LONG', 'SHORT')),
  entry_date DATE NOT NULL,
  entry_time TIME,
  entry_price NUMERIC NOT NULL,
  quantity NUMERIC NOT NULL,
  setup_stop_loss NUMERIC,
  current_stop_loss NUMERIC,
  target NUMERIC,
  target_rpt NUMERIC DEFAULT 2000,
  current_price NUMERIC,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'PARTIAL', 'CLOSED')),
  remaining_quantity NUMERIC NOT NULL,
  booked_profit NUMERIC NOT NULL DEFAULT 0,
  total_pnl NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create exits table
CREATE TABLE public.exits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_id UUID NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  exit_date DATE NOT NULL,
  exit_price NUMERIC NOT NULL,
  quantity NUMERIC NOT NULL,
  pnl NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exits ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for trades
CREATE POLICY "Users can view their own trades" 
ON public.trades 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own trades" 
ON public.trades 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trades" 
ON public.trades 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trades" 
ON public.trades 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for exits
CREATE POLICY "Users can view exits for their trades" 
ON public.exits 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.trades 
  WHERE trades.id = exits.trade_id 
  AND trades.user_id = auth.uid()
));

CREATE POLICY "Users can create exits for their trades" 
ON public.exits 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.trades 
  WHERE trades.id = exits.trade_id 
  AND trades.user_id = auth.uid()
));

CREATE POLICY "Users can delete exits for their trades" 
ON public.exits 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.trades 
  WHERE trades.id = exits.trade_id 
  AND trades.user_id = auth.uid()
));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_trades_updated_at
BEFORE UPDATE ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();