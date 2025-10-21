#!/bin/bash

# Script de deploy para VPS Hostinger
# Uso: ./deploy.sh

echo "🚀 Iniciando deploy..."

# Para os containers em execução
echo "⏹️  Parando containers..."
docker-compose down

# Remove imagens antigas
echo "🗑️  Limpando imagens antigas..."
docker image prune -f

# Rebuild e start dos containers
echo "🔨 Construindo e iniciando containers..."
docker-compose up -d --build

# Verifica status
echo "✅ Verificando status dos containers..."
docker-compose ps

# Mostra logs
echo "📋 Últimos logs:"
docker-compose logs --tail=50

echo "✨ Deploy concluído!"
