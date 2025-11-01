import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { UserPlanProvider } from "@/components/UserPlanProvider";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import CRMPage from "./pages/CRMPage";
import ColetarLeadsPage from "./pages/ColetarLeadsPage";
import DisparadorPage from "./pages/DisparadorPage";
import MonitorConsultivoPage from "./pages/MonitorConsultivoPage";
import WhatsAppRAGPage from "./pages/WhatsAppRAGPage";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UserPlanProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/crm" element={<CRMPage />} />
                <Route path="/coletar-leads" element={<ColetarLeadsPage />} />
                <Route path="/disparador" element={<DisparadorPage />} />
                <Route path="/monitor-consultivo" element={<MonitorConsultivoPage />} />
                <Route path="/whatsapp-rag" element={<WhatsAppRAGPage />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </UserPlanProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
