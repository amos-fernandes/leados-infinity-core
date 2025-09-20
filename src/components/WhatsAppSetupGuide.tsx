import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, ExternalLink, AlertTriangle, ArrowRight } from "lucide-react";

const WhatsAppSetupGuide = () => {
  const steps = [
    {
      id: 1,
      title: "Criar conta Meta Business",
      description: "Crie uma conta business no Facebook/Meta",
      link: "https://business.facebook.com/",
      completed: false
    },
    {
      id: 2,
      title: "Configurar WhatsApp Business API",
      description: "Configure o app e obtenha as credenciais",
      link: "https://developers.facebook.com/apps",
      completed: false
    },
    {
      id: 3,
      title: "Obter Token de Acesso Permanente",
      description: "Gere um token permanente para produção",
      link: "https://developers.facebook.com/docs/whatsapp/business-management-api/get-started#permanent-token",
      completed: false
    },
    {
      id: 4,
      title: "Configurar Webhook",
      description: "Configure o webhook no seu app Meta",
      link: "#",
      completed: false
    }
  ];

  const webhookUrl = "https://ibaonnnakuuerrgtilze.supabase.co/functions/v1/whatsapp-webhook";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Guia de Configuração WhatsApp Business
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>✅ Sistema WhatsApp implementado!</strong> 
            Agora você precisa configurar as credenciais do WhatsApp Business API.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          {steps.map((step) => (
            <div
              key={step.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card"
            >
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                  {step.id}
                </div>
              </div>
              
              <div className="flex-1">
                <h4 className="font-medium">{step.title}</h4>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
              
              {step.link !== "#" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(step.link, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
              
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          ))}
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>URL do Webhook:</strong><br />
            <code className="text-sm bg-muted px-2 py-1 rounded font-mono break-all">
              {webhookUrl}
            </code><br />
            <span className="text-sm text-muted-foreground">
              Use esta URL ao configurar o webhook no Meta Developer Console
            </span>
          </AlertDescription>
        </Alert>

        <div className="bg-muted/50 p-4 rounded-lg">
          <h4 className="font-medium mb-2">Funcionalidades já implementadas:</h4>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>✅ Webhook para receber mensagens</li>
            <li>✅ Envio de mensagens via API oficial</li>
            <li>✅ Bot inteligente com respostas automáticas</li>
            <li>✅ Armazenamento de conversas</li>
            <li>✅ Interface de configuração</li>
            <li>✅ Fallback para modo simulação</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default WhatsAppSetupGuide;