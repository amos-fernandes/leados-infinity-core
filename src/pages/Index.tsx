import { Navigate } from "react-router-dom";
import { useState, useEffect, lazy, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ProspectCollector } from "@/components/ProspectCollector";
import { ProspectingOrchestrator } from "@/components/ProspectingOrchestrator";
import LandingPage from "@/components/LandingPage";
import Dashboard from "@/components/Dashboard";
import RAGChat from "@/components/RAGChat";
import CRMDashboard from "@/components/CRM/CRMDashboard";
import WhatsAppBot from "@/components/WhatsAppBot";
import WhatsAppDashboard from "@/components/WhatsAppDashboard";
import WhatsAppConversations from "@/components/WhatsAppConversations";
import RAGAttendanceMonitor from "@/components/RAGAttendanceMonitor";
import WhatsAppConnector from "@/components/WhatsAppConnector";
import EvolutionDashboard from "@/components/EvolutionDashboard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const CampaignTestPanel = lazy(() => import("@/components/CampaignTestPanel"));

const Index = () => {
  const { user, loading } = useAuth();
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [showWhatsAppDashboard, setShowWhatsAppDashboard] = useState(false);
  const [showWhatsAppConnector, setShowWhatsAppConnector] = useState(false);
  const [showEvolutionDashboard, setShowEvolutionDashboard] = useState(false);
  const [showCampaignTest, setShowCampaignTest] = useState(false);

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

    const handleOpenEvolutionDashboard = () => {
      setShowEvolutionDashboard(true);
    };

    const handleOpenCampaignTest = () => {
      setShowCampaignTest(true);
    };

    window.addEventListener('openWhatsAppBot', handleOpenWhatsApp);
    window.addEventListener('openWhatsAppDashboard', handleOpenWhatsAppDashboard);
    window.addEventListener('openWhatsAppConnector', handleOpenWhatsAppConnector);
    window.addEventListener('openEvolutionDashboard', handleOpenEvolutionDashboard);
    window.addEventListener('openCampaignTest', handleOpenCampaignTest);
    
    return () => {
      window.removeEventListener('openWhatsAppBot', handleOpenWhatsApp);
      window.removeEventListener('openWhatsAppDashboard', handleOpenWhatsAppDashboard);
      window.removeEventListener('openWhatsAppConnector', handleOpenWhatsAppConnector);
      window.removeEventListener('openEvolutionDashboard', handleOpenEvolutionDashboard);
      window.removeEventListener('openCampaignTest', handleOpenCampaignTest);
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

  // Se está na dashboard da Evolution API, mostrar ela
  if (showEvolutionDashboard) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card">
          <div className="container mx-auto px-6 py-4">
            <button
              onClick={() => setShowEvolutionDashboard(false)}
              className="text-primary hover:underline"
            >
              ← Voltar ao Dashboard
            </button>
          </div>
        </div>
        <EvolutionDashboard />
      </div>
    );
  }

  // Se está no painel de testes de campanha, mostrar ele
  if (showCampaignTest) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card">
          <div className="container mx-auto px-6 py-4">
            <button
              onClick={() => setShowCampaignTest(false)}
              className="text-primary hover:underline"
            >
              ← Voltar ao Dashboard
            </button>
          </div>
        </div>
        <Suspense fallback={<div className="p-8 text-center">Carregando...</div>}>
          <CampaignTestPanel />
        </Suspense>
      </div>
    );
  }

  // Se há usuário, mostrar o dashboard da aplicação
  return (
    <>
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-6 py-8 space-y-8">
          <Dashboard />
          <ProspectingOrchestrator />
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
