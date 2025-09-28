import { Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ProspectCollector } from "@/components/ProspectCollector";
import LandingPage from "@/components/LandingPage";
import Dashboard from "@/components/Dashboard";
import RAGChat from "@/components/RAGChat";
import CRMDashboard from "@/components/CRM/CRMDashboard";
import WhatsAppBot from "@/components/WhatsAppBot";
import WhatsAppDashboard from "@/components/WhatsAppDashboard";
import WhatsAppConversations from "@/components/WhatsAppConversations";
import RAGAttendanceMonitor from "@/components/RAGAttendanceMonitor";
import WhatsAppConnector from "@/components/WhatsAppConnector";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const Index = () => {
  const { user, loading } = useAuth();
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [showWhatsAppDashboard, setShowWhatsAppDashboard] = useState(false);
  const [showWhatsAppConnector, setShowWhatsAppConnector] = useState(false);

  useEffect(() => {
    const handleOpenWhatsApp = () => {
      setShowWhatsApp(true);
    };

    const handleOpenWhatsAppDashboard = () => {
      setShowWhatsAppDashboard(true);
    };

    const handleOpenWhatsAppConnector = () => {
      setShowWhatsAppConnector(true);
    };

    window.addEventListener('openWhatsAppBot', handleOpenWhatsApp);
    window.addEventListener('openWhatsAppDashboard', handleOpenWhatsAppDashboard);
    window.addEventListener('openWhatsAppConnector', handleOpenWhatsAppConnector);
    
    return () => {
      window.removeEventListener('openWhatsAppBot', handleOpenWhatsApp);
      window.removeEventListener('openWhatsAppDashboard', handleOpenWhatsAppDashboard);
      window.removeEventListener('openWhatsAppConnector', handleOpenWhatsAppConnector);
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
    <>
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-6 py-8 space-y-8">
          <Dashboard />
          <ProspectCollector />
          <CRMDashboard />
          <RAGAttendanceMonitor />
          <WhatsAppConversations />
          {showWhatsApp ? <WhatsAppBot /> : <RAGChat />}
        </main>
      </div>

      {/* WhatsApp Connector Modal */}
      <Dialog open={showWhatsAppConnector} onOpenChange={setShowWhatsAppConnector}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">📱</span>
              Conector WhatsApp Business
            </DialogTitle>
          </DialogHeader>
          <WhatsAppConnector />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Index;
