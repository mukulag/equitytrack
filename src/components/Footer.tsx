import { Heart } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

export const Footer = () => {
  return (
    <footer className="border-t border-border/50 bg-card/30 mt-auto">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Made with <Heart className="h-3 w-3 inline text-red-500" /> for traders
        </p>
        <div className="md:hidden">
          <ThemeToggle />
        </div>
      </div>
    </footer>
  );
};
