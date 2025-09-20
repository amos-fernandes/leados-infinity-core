import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Target, 
  TrendingUp, 
  Clock, 
  Database, 
  Zap,
  ArrowRight,
  Check,
  Star,
  Play
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const LandingPage = () => {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const { signUp, signIn } = useAuth();

  const testimonials = [
    {
      name: "Carlos Silva",
      role: "Diretor Comercial",
      company: "TechSolutions",
      image: "/placeholder.svg",
      content: "Aumentamos nossa taxa de resposta em 45% com o Leados AI. A qualidade dos leads é excepcional.",
      metric: "45% mais conversões"
    },
    {
      name: "Ana Costa", 
      role: "CEO",
      company: "MarketPro",
      image: "/placeholder.svg",
      content: "Economizamos 15 horas por semana na prospecção. Agora focamos em fechar negócios.",
      metric: "15h/semana economizadas"
    },
    {
      name: "Pedro Santos",
      role: "Head de Vendas", 
      company: "SalesForce Brasil",
      image: "/placeholder.svg",
      content: "O ROI foi de 300% no primeiro mês. Ferramenta indispensável para nossa equipe.",
      metric: "300% ROI"
    }
  ];

  const plans = [
    {
      name: "Gratuito",
      price: { monthly: 0, yearly: 0 },
      popular: false,
      description: "Para sempre grátis. Ideal para experimentar.",
      features: [
        "10 leads por mês",
        "Dados básicos de CNPJ",
        "Pesquisa por setor",
        "Suporte por email"
      ],
      limitations: [
        "Sem exportação para CRM",
        "Sem dados enriquecidos",
        "Limite de 10 leads/mês"
      ],
      cta: "Começar Gratuitamente",
      ctaVariant: "outline" as const
    },
    {
      name: "Pro", 
      price: { monthly: 97, yearly: 87 },
      popular: true,
      description: "O mais popular. Para equipes que vendem sério.",
      features: [
        "500 leads por mês",
        "Dados completos de CNPJ + receita",
        "Exportação para CRM",
        "Integração WhatsApp/Email",
        "Análise de tecnologias",
        "Qualificação automática",
        "Suporte prioritário",
        "Treinamento personalizado"
      ],
      limitations: [],
      cta: "Teste Gratuito 7 Dias",
      ctaVariant: "default" as const
    },
    {
      name: "Enterprise",
      price: { monthly: 297, yearly: 267 },
      popular: false,
      description: "Para grandes equipes e agências.",
      features: [
        "2000 leads por mês",
        "API dedicada",
        "Múltiplos usuários",
        "Relatórios avançados",
        "Integrações personalizadas",
        "Account manager dedicado",
        "SLA garantido",
        "Onboarding premium"
      ],
      limitations: [],
      cta: "Falar com Vendas",
      ctaVariant: "outline" as const
    }
  ];

  const handleStartTrial = async (planName: string) => {
    try {
      // Redirecionar para cadastro com plano selecionado
      const params = new URLSearchParams({ plan: planName.toLowerCase() });
      window.location.href = `/auth?${params.toString()}`;
    } catch (error) {
      console.error('Erro ao iniciar teste:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header/Navigation */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <Target className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold">Leados AI</span>
          </div>
          <Button variant="outline" onClick={() => window.location.href = '/auth'}>
            Entrar
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 lg:py-32 bg-gradient-to-br from-primary/5 to-secondary/10">
        <div className="container mx-auto px-6 text-center">
          <Badge className="mb-6 bg-primary/10 text-primary border-primary/20">
            Mais de 1.500 empresas confiam no Leados AI
          </Badge>
          
          <h1 className="text-4xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
            Sua prospecção B2B,<br />
            <span className="text-primary">automatizada</span>
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Encontre e qualifique decisores, enriqueça dados com informações de CNPJ 
            e exporte para o seu CRM em minutos. Foque em fechar, não em procurar.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button 
              size="lg" 
              className="text-lg px-8 py-4"
              onClick={() => handleStartTrial('pro')}
            >
              <Play className="mr-2 h-5 w-5" />
              Teste Gratuitamente por 7 Dias
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              className="text-lg px-8 py-4"
              onClick={() => handleStartTrial('gratuito')}
            >
              Começar Grátis Agora
            </Button>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Sem necessidade de cartão de crédito • Cancele quando quiser
          </p>
          
          {/* Hero Visual - Placeholder for product demo */}
          <div className="mt-16 relative">
            <div className="bg-white rounded-2xl shadow-2xl border p-8 max-w-4xl mx-auto">
              <div className="animate-pulse">
                <div className="h-64 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-lg"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-2xl font-semibold mb-8">
            Junte-se a mais de 1.500 empresas que aceleram suas vendas conosco
          </h2>
          
          <div className="flex items-center justify-center gap-8 opacity-60">
            {/* Placeholder for client logos */}
            <div className="text-4xl font-bold text-primary">1500+</div>
            <div className="text-lg">Clientes Satisfeitos</div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-6">
              Como resolvemos sua dor de cabeça
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Pare de perder tempo com prospecção manual. Deixe a IA trabalhar por você.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center p-8 border-none shadow-soft">
              <CardContent className="pt-6">
                <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Clock className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-4">Economize Tempo</h3>
                <p className="text-muted-foreground mb-6">
                  Deixe o trabalho manual para trás. Gere listas de leads qualificados 
                  em 90% menos tempo.
                </p>
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  90% menos tempo
                </Badge>
              </CardContent>
            </Card>
            
            <Card className="text-center p-8 border-none shadow-soft">
              <CardContent className="pt-6">
                <div className="w-16 h-16 bg-gradient-secondary rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Database className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-4">Inteligência de Dados</h3>
                <p className="text-muted-foreground mb-6">
                  Vá além do e-mail. Tenha acesso a dados de CNPJ, tecnologias usadas 
                  e mais para uma abordagem personalizada.
                </p>
                <Badge variant="secondary" className="bg-secondary/10 text-secondary">
                  Dados enriquecidos
                </Badge>
              </CardContent>
            </Card>
            
            <Card className="text-center p-8 border-none shadow-soft">
              <CardContent className="pt-6">
                <div className="w-16 h-16 bg-gradient-success rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <TrendingUp className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-4">Venda Mais</h3>
                <p className="text-muted-foreground mb-6">
                  Com leads de alta qualidade, sua equipe de vendas passa mais tempo 
                  em reuniões e fechando negócios.  
                </p>
                <Badge variant="secondary" className="bg-accent/10 text-accent">
                  Mais conversões
                </Badge>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-6">
              O que nossos clientes dizem
            </h2>
            <div className="flex justify-center gap-1 mb-4">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-6 w-6 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <p className="text-muted-foreground">4.9/5 estrelas • Mais de 500 avaliações</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-none shadow-soft">
                <CardContent className="p-8">
                  <div className="flex justify-center gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  
                  <blockquote className="text-lg mb-6">
                    "{testimonial.content}"
                  </blockquote>
                  
                  <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
                    {testimonial.metric}
                  </Badge>
                  
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center">
                      <Users className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold">{testimonial.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {testimonial.role}, {testimonial.company}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-6">
              Preços claros e transparentes
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Escolha o plano ideal para sua equipe. Todos com 7 dias de teste gratuito.
            </p>
            
            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4 mb-12">
              <span className={billingPeriod === 'monthly' ? 'font-semibold' : 'text-muted-foreground'}>
                Mensal
              </span>
              <button
                onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'yearly' : 'monthly')}
                className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    billingPeriod === 'yearly' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={billingPeriod === 'yearly' ? 'font-semibold' : 'text-muted-foreground'}>
                Anual
                <Badge className="ml-2 bg-accent/10 text-accent">-20%</Badge>
              </span>
            </div>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan, index) => (
              <Card 
                key={index} 
                className={`relative border-2 ${
                  plan.popular ? 'border-primary shadow-2xl scale-105' : 'border-border'
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                    Mais Popular
                  </Badge>
                )}
                
                <CardContent className="p-8">
                  <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                    <p className="text-muted-foreground mb-4">{plan.description}</p>
                    
                    <div className="mb-6">
                      <span className="text-4xl font-bold">
                        R$ {plan.price[billingPeriod]}
                      </span>
                      {plan.price.monthly > 0 && (
                        <span className="text-muted-foreground">/mês</span>
                      )}
                    </div>
                    
                    <Button 
                      className="w-full mb-6"
                      variant={plan.ctaVariant}
                      size="lg"
                      onClick={() => handleStartTrial(plan.name)}
                    >
                      {plan.cta}
                      {plan.name !== 'Enterprise' && <ArrowRight className="ml-2 h-4 w-4" />}
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    {plan.features.map((feature, featureIndex) => (
                      <div key={featureIndex} className="flex items-center gap-3">
                        <Check className="h-5 w-5 text-primary flex-shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                  
                  {plan.limitations.length > 0 && (
                    <div className="mt-6 pt-6 border-t">
                      <p className="text-sm text-muted-foreground mb-3">Limitações:</p>
                      {plan.limitations.map((limitation, limitIndex) => (
                        <div key={limitIndex} className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="w-2 h-2 bg-muted-foreground rounded-full flex-shrink-0"></span>
                          <span>{limitation}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-primary text-white">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-6">
            Pronto para revolucionar sua prospecção?
          </h2>
          <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
            Junte-se a mais de 1.500 empresas que já transformaram suas vendas com o Leados AI.
          </p>
          
          <Button 
            size="lg" 
            variant="secondary"
            className="text-lg px-8 py-4 bg-white text-primary hover:bg-white/90"
            onClick={() => handleStartTrial('pro')}
          >
            <Zap className="mr-2 h-5 w-5" />
            Gere seus primeiros leads grátis agora
          </Button>
          
          <p className="text-sm text-white/60 mt-4">
            Sem compromisso • Cancele quando quiser
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                <Target className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold">Leados AI</span>
            </div>
            
            <div className="flex gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Termos de Uso</a>
              <a href="#" className="hover:text-foreground transition-colors">Privacidade</a>
              <a href="#" className="hover:text-foreground transition-colors">Suporte</a>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
            © 2024 Leados AI. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;