-- Create table for extracted account information
CREATE TABLE public.extracted_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'error')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.extracted_accounts ENABLE ROW LEVEL SECURITY;

-- Create policy for public access based on device_id (no auth required)
CREATE POLICY "Anyone can view their device accounts" 
ON public.extracted_accounts 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert accounts" 
ON public.extracted_accounts 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update their device accounts" 
ON public.extracted_accounts 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete their device accounts" 
ON public.extracted_accounts 
FOR DELETE 
USING (true);

-- Create index for device_id for faster queries
CREATE INDEX idx_extracted_accounts_device_id ON public.extracted_accounts(device_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_extracted_accounts_updated_at
BEFORE UPDATE ON public.extracted_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();