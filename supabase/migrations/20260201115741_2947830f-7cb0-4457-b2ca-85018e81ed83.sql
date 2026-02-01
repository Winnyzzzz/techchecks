-- Create share_links table to store shareable codes
CREATE TABLE public.share_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL UNIQUE,
  share_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert and read share links
CREATE POLICY "Anyone can create share links"
ON public.share_links FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can view share links"
ON public.share_links FOR SELECT
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_share_links_share_code ON public.share_links(share_code);
CREATE INDEX idx_share_links_device_id ON public.share_links(device_id);