import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ShopProvider } from "@/contexts/ShopContext";
import { SearchProvider } from "@/contexts/SearchContext";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireShop } from "@/components/RequireShop";
import { RequireRole } from "@/components/RequireRole";
import { RequireSubscription } from "@/components/RequireSubscription";
import { RequireSuperAdmin } from "@/components/RequireSuperAdmin";
import { AppLayout } from "@/components/layout/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { useMobileKeyboardScroll } from "@/hooks/useMobileKeyboardScroll";

// Lazy-load every route so the initial bundle stays small and the app boots fast.
const Auth = lazy(() => import("./pages/Auth"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const PendingInvite = lazy(() => import("./pages/PendingInvite"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const POS = lazy(() => import("./pages/POS"));
const Products = lazy(() => import("./pages/Products"));
const Sales = lazy(() => import("./pages/Sales"));
const Returns = lazy(() => import("./pages/Returns"));
const Customers = lazy(() => import("./pages/Customers"));
const Settings = lazy(() => import("./pages/Settings"));
const Staff = lazy(() => import("./pages/Staff"));
const Purchases = lazy(() => import("./pages/Purchases"));
const Expenses = lazy(() => import("./pages/Expenses"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Reports = lazy(() => import("./pages/Reports"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Billing = lazy(() => import("./pages/Billing"));

const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Support = lazy(() => import("./pages/Support"));
const Debts = lazy(() => import("./pages/Debts"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const PlanRequired = lazy(() => import("./pages/PlanRequired"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Refunds = lazy(() => import("./pages/Refunds"));


const queryClient = new QueryClient();

const Shell = ({ children }: { children: React.ReactNode }) => (
  <RequireAuth><RequireShop><AppLayout>{children}</AppLayout></RequireShop></RequireAuth>
);

const SubShell = ({ children }: { children: React.ReactNode }) => (
  <RequireAuth><RequireShop><RequireSubscription><AppLayout>{children}</AppLayout></RequireSubscription></RequireShop></RequireAuth>
);


const RouteFallback = () => (
  <div className="p-4 lg:p-8 space-y-6 animate-in fade-in duration-300" aria-busy="true" aria-live="polite">
    {/* Page header */}
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-9 w-28" />
    </div>

    {/* Stat cards */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>

    {/* Table / list */}
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="p-4 border-b flex items-center justify-between gap-3">
        <Skeleton className="h-9 w-full max-w-xs" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="divide-y">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-4 flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-8 w-20 hidden sm:block" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

const HomeRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return <RouteFallback />;
  if (!user) return <Auth />;
  return <SubShell><Dashboard /></SubShell>;
};

const App = () => {
  useMobileKeyboardScroll();
  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-right" richColors />
      <BrowserRouter>
        <AuthProvider>
          <ShopProvider>
            <SearchProvider>
            <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/refunds" element={<Refunds />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
              <Route path="/pending-invite" element={<RequireAuth><PendingInvite /></RequireAuth>} />
              <Route path="/plan-required" element={<RequireAuth><RequireShop><PlanRequired /></RequireShop></RequireAuth>} />
              <Route path="/" element={<HomeRoute />} />
              <Route path="/pos" element={<SubShell><POS /></SubShell>} />
              <Route path="/products" element={<SubShell><Products /></SubShell>} />
              <Route path="/sales" element={<SubShell><Sales /></SubShell>} />
              <Route path="/returns" element={<SubShell><Returns /></SubShell>} />
              <Route path="/customers" element={<SubShell><Customers /></SubShell>} />
              <Route path="/debts" element={<SubShell><RequireRole roles={["owner", "manager"]}><Debts /></RequireRole></SubShell>} />
              <Route path="/purchases" element={<SubShell><RequireRole roles={["owner", "manager"]}><Purchases /></RequireRole></SubShell>} />
              <Route path="/suppliers" element={<SubShell><RequireRole roles={["owner", "manager"]}><Suppliers /></RequireRole></SubShell>} />
              <Route path="/expenses" element={<SubShell><RequireRole roles={["owner", "manager"]}><Expenses /></RequireRole></SubShell>} />
              <Route path="/staff" element={<SubShell><RequireRole roles={["owner"]}><Staff /></RequireRole></SubShell>} />
              <Route path="/analytics" element={<SubShell><RequireRole roles={["owner", "manager"]}><Analytics /></RequireRole></SubShell>} />
              <Route path="/reports" element={<SubShell><RequireRole roles={["owner", "manager"]}><Reports /></RequireRole></SubShell>} />
              <Route path="/inventory" element={<SubShell><RequireRole roles={["owner", "manager"]}><Inventory /></RequireRole></SubShell>} />
              <Route path="/billing" element={<Shell><Billing /></Shell>} />
              <Route path="/admin" element={<Shell><RequireSuperAdmin><AdminDashboard /></RequireSuperAdmin></Shell>} />
              
              <Route path="/settings" element={<Shell><Settings /></Shell>} />
              <Route path="/support" element={<Shell><Support /></Shell>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </SearchProvider>
          </ShopProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
