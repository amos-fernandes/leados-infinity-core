import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/components/Dashboard";
import { MetricsCards } from "@/components/dashboard/MetricsCards";
import { useAuth } from "@/hooks/useAuth";
import LandingPage from "@/components/LandingPage";

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-primary text-lg">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8 space-y-8">
        <MetricsCards />
        <Dashboard />
      </div>
    </AppLayout>
  );
}
