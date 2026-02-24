-- Add column for CSV file URL
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS csv_file_url text;

-- Add column for CSV file Name (optional but good for display)
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS csv_file_name text;
