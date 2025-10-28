import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface EvolutionInstanceFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const EvolutionInstanceForm = ({ onSuccess, onCancel }: EvolutionInstanceFormProps) => {
  const [instanceName, setInstanceName] = useState('');
  const [instanceUrl, setInstanceUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('evolution-manage-instance', {
        body: {
          action: 'create',
          instanceData: {
            instanceName,
            instanceUrl,
            apiKey
          }
        }
      });

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Instância criada com sucesso'
      });

      onSuccess();
    } catch (error) {
      console.error('Error creating instance:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao criar instância',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="instanceName">Nome da Instância</Label>
        <Input
          id="instanceName"
          value={instanceName}
          onChange={(e) => setInstanceName(e.target.value)}
          placeholder="ex: consultor1, vendas, suporte"
          required
        />
        <p className="text-sm text-muted-foreground mt-1">
          Use nomes descritivos como: consultor1, consultor2, suporte, vendas
        </p>
      </div>

      <div>
        <Label htmlFor="instanceUrl">URL da Evolution API</Label>
        <Input
          id="instanceUrl"
          value={instanceUrl}
          onChange={(e) => setInstanceUrl(e.target.value)}
          placeholder="https://sua-evolution-api.com"
          required
        />
        <p className="text-sm text-muted-foreground mt-1">
          URL base da sua instalação Evolution API
        </p>
      </div>

      <div>
        <Label htmlFor="apiKey">API Key</Label>
        <Input
          id="apiKey"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Sua chave API"
          required
        />
        <p className="text-sm text-muted-foreground mt-1">
          Chave de API da sua instância Evolution
        </p>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Criando...' : 'Criar Instância'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
};

export default EvolutionInstanceForm;
