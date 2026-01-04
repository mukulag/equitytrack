import { useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { z } from 'zod';

const feedbackSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  email: z.string().trim().email("Invalid email address").max(255, "Email must be less than 255 characters"),
  category: z.enum(["comment", "suggestion", "bug", "other"], { required_error: "Please select a category" }),
  message: z.string().trim().min(1, "Message is required").max(2000, "Message must be less than 2000 characters"),
});

export const FeedbackForm = ({ onSuccess }: { onSuccess?: () => void }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState<string>('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate input
    const result = feedbackSchema.safeParse({ name, email, category, message });
    if (!result.success) {
      const firstError = result.error.errors[0];
      toast.error(firstError.message);
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-feedback-email', {
        body: { name, email, category, message },
      });

      if (error) throw error;

      toast.success('Thank you for your feedback!');
      setName('');
      setEmail('');
      setCategory('');
      setMessage('');
      onSuccess?.();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="feedback-name" className="text-sm text-muted-foreground">
            Name
          </Label>
          <Input
            id="feedback-name"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-background/50"
            maxLength={100}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="feedback-email" className="text-sm text-muted-foreground">
            Email
          </Label>
          <Input
            id="feedback-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-background/50"
            maxLength={255}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="feedback-category" className="text-sm text-muted-foreground">
          Category
        </Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="bg-background/50">
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="comment">Comment</SelectItem>
            <SelectItem value="suggestion">Suggestion</SelectItem>
            <SelectItem value="bug">Bug Report</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="feedback-message" className="text-sm text-muted-foreground">
          Message
        </Label>
        <Textarea
          id="feedback-message"
          placeholder="Share your thoughts, suggestions, or report an issue..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="bg-background/50 min-h-[100px] resize-none"
          maxLength={2000}
        />
      </div>
      <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
        {isSubmitting ? (
          'Sending...'
        ) : (
          <>
            <Send className="h-4 w-4 mr-2" />
            Send Feedback
          </>
        )}
      </Button>
    </form>
  );
};
