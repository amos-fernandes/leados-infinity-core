import { Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import LandingPage from "@/components/LandingPage";
import Dashboard from "@/components/Dashboard";
import RAGChat from "@/components/RAGChat";
import CRMDashboard from "@/components/CRM/CRMDashboard";
import WhatsAppBot from "@/components/WhatsAppBot";
import WhatsAppDashboard from "@/components/WhatsAppDashboard";

const Index = () => {
  const { user, loading } = useAuth();
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [showWhatsAppDashboard, setShowWhatsAppDashboard] = useState(false);

  useEffect(() => {
    const handleOpenWhatsApp = () => {
      setShowWhatsApp(true);
    };

    const handleOpenWhatsAppDashboard = () => {
      setShowWhatsAppDashboard(true);
    };

    window.addEventListener('openWhatsAppBot', handleOpenWhatsApp);
    window.addEventListener('openWhatsAppDashboard', handleOpenWhatsAppDashboard);
    
    return () => {
      window.removeEventListener('openWhatsAppBot', handleOpenWhatsApp);
      window.removeEventListener('openWhatsAppDashboard', handleOpenWhatsAppDashboard);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-primary text-lg">Carregando...</div>
      </div>
    );
  }

  // Se não há usuário, mostrar landing page
  // Se não há usuário, mostrar landing page
  if (!user) {
    return <LandingPage />;
  }

  // Se está na dashboard do WhatsApp, mostrar ela
  if (showWhatsAppDashboard) {
    return (
      <WhatsAppDashboard onGoBack={() => setShowWhatsAppDashboard(false)} />
    );
  }

  // Se há usuário, mostrar o dashboard da aplicação
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-6 py-8 space-y-8">
        <Dashboard />
        <CRMDashboard />
        {showWhatsApp ? <WhatsAppBot /> : <RAGChat />}
      </main>
    </div>
  );
};

export default Index;
