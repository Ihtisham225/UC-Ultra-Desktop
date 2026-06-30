import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { usePageMeta } from "@/hooks/usePageMeta";

interface Props {
  title: string;
  description: string;
  path: string;
  children: ReactNode;
}

export const LegalLayout = ({ title, description, path, children }: Props) => {
  usePageMeta({ title: `${title} — UCU`, description, path });
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo size="sm" />
            <span className="font-bold">UCU</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/pricing" className="hover:underline">Pricing</Link>
            <Link to="/auth" className="hover:underline">Sign in</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold mb-2">{title}</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: May 2026</p>
        <article className="prose prose-sm dark:prose-invert max-w-none space-y-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-2 [&_h3]:font-semibold [&_h3]:mt-4 [&_ul]:list-disc [&_ul]:ps-6 [&_a]:underline">
          {children}
        </article>
      </main>
      <PublicFooter />
    </div>
  );
};

export const PublicFooter = () => (
  <footer className="border-t mt-auto">
    <div className="max-w-4xl mx-auto px-6 py-6 flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
      <div>© {new Date().getFullYear()} Tech Town Swat. All rights reserved.</div>
      <nav className="flex flex-wrap gap-4">
        <Link to="/pricing" className="hover:underline">Pricing</Link>
        <Link to="/terms" className="hover:underline">Terms</Link>
        <Link to="/privacy" className="hover:underline">Privacy</Link>
        <Link to="/refunds" className="hover:underline">Refunds</Link>
        <Link to="/support" className="hover:underline">Support</Link>
      </nav>
    </div>
  </footer>
);
