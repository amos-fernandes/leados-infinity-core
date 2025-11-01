import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Bot, Smartphone } from "lucide-react";
import WhatsAppDashboard from "@/components/WhatsAppDashboard";
import EvolutionDashboard from "@/components/EvolutionDashboard";
import RAGAttendanceMonitor from "@/components/RAGAttendanceMonitor";

export default function WhatsAppRAGPage() {
  const [activeTab, setActiveTab] = useState("whatsapp");

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">WhatsApp RAG</h1>
          <p className="text-muted-foreground">
            Central de atendimento inteligente com IA e API WhatsApp
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="whatsapp" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              WhatsApp Business
            </TabsTrigger>
            <TabsTrigger value="evolution" className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              Evolution API
            </TabsTrigger>
            <TabsTrigger value="monitor" className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Monitor RAG
            </TabsTrigger>
          </TabsList>

          <TabsContent value="whatsapp">
            <WhatsAppDashboard onGoBack={() => setActiveTab("whatsapp")} />
          </TabsContent>

          <TabsContent value="evolution">
            <EvolutionDashboard />
          </TabsContent>

          <TabsContent value="monitor">
            <RAGAttendanceMonitor />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
