-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view feedback" ON public.feedback;

-- Create a more restrictive policy - only allow viewing own submissions or future admin role
-- For now, no one can read feedback except through backend/admin dashboard
CREATE POLICY "No public read access to feedback"
ON public.feedback
FOR SELECT
USING (false);