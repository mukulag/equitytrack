import { Heart, ExternalLink } from 'lucide-react';
import { FeedbackForm } from './FeedbackForm';
import { Button } from '@/components/ui/button';

interface FooterProps {
  paypalEmail?: string;
}

export const Footer = ({ paypalEmail = "YOUR_PAYPAL_EMAIL" }: FooterProps) => {
  const paypalDonateUrl = `https://www.paypal.com/donate/?business=${encodeURIComponent(paypalEmail)}&currency_code=INR`;

  return (
    <footer className="border-t border-border/50 bg-card/30 mt-auto">
      <div className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Feedback Form Section */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-1">Share Your Feedback</h3>
              <p className="text-sm text-muted-foreground">
                Have a suggestion, found a bug, or just want to say hi? We'd love to hear from you!
              </p>
            </div>
            <FeedbackForm />
          </div>

          {/* Support Section */}
          <div className="space-y-6 lg:pl-8 lg:border-l border-border/30">
            <div>
              <h3 className="text-lg font-semibold mb-1">Support This Project</h3>
              <p className="text-sm text-muted-foreground">
                If you find Trade Journal helpful, consider supporting its development with a small donation.
              </p>
            </div>
            
            <div className="p-6 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Heart className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Your support matters</p>
                  <p className="text-xs text-muted-foreground">
                    Every contribution helps keep this project alive
                  </p>
                </div>
              </div>
              
              <Button
                asChild
                className="w-full bg-[#0070ba] hover:bg-[#005ea6] text-white"
              >
                <a
                  href={paypalDonateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg
                    className="h-5 w-5 mr-2"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.774.774 0 0 1 .763-.65h7.073c2.345 0 4.085.645 5.146 1.897.967 1.14 1.304 2.66.997 4.526-.05.3-.114.587-.19.863-.657 2.39-2.143 4.072-4.392 4.994-1.038.424-2.197.637-3.474.637H8.614a.774.774 0 0 0-.763.65l-.775 4.7zm12.29-14.203c-.05.3-.114.587-.19.863-.657 2.39-2.143 4.072-4.392 4.994-1.038.424-2.197.637-3.474.637H9.057a.774.774 0 0 0-.763.65l-1.179 7.149h3.193a.641.641 0 0 0 .633-.54l.026-.148.505-3.065.033-.169a.641.641 0 0 1 .633-.54h.398c2.584 0 4.608-.994 5.2-3.868.247-1.2.119-2.201-.534-2.905a2.387 2.387 0 0 0-.736-.558z" />
                  </svg>
                  Donate with PayPal
                  <ExternalLink className="h-4 w-4 ml-2" />
                </a>
              </Button>

              <p className="text-xs text-muted-foreground text-center mt-3">
                Secure payment via PayPal
              </p>
            </div>

            <div className="text-center text-xs text-muted-foreground pt-4">
              <p>Made with <Heart className="h-3 w-3 inline text-red-500" /> for traders</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
