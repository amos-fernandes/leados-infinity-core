#!/bin/bash

# =============================================================================
# Deploy Script para DigitalOcean Droplet (CPU-only)
# LEADOS Infinity - Sistema de Prospecção Automatizada
# =============================================================================

set -e  # Para o script em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}   LEADOS Infinity - Deploy DigitalOcean    ${NC}"
echo -e "${BLUE}=============================================${NC}"

# Variáveis de configuração
APP_NAME="leados-app"
APP_PORT=8081
INTERNAL_PORT=8080

# Função para verificar dependências
check_dependencies() {
    echo -e "\n${YELLOW}📋 Verificando dependências...${NC}"
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker não encontrado. Instalando...${NC}"
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        sudo usermod -aG docker $USER
        rm get-docker.sh
        echo -e "${GREEN}✅ Docker instalado${NC}"
    else
        echo -e "${GREEN}✅ Docker já instalado${NC}"
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}❌ Docker Compose não encontrado. Instalando...${NC}"
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
        echo -e "${GREEN}✅ Docker Compose instalado${NC}"
    else
        echo -e "${GREEN}✅ Docker Compose já instalado${NC}"
    fi
}

# Função para verificar arquivo de ambiente
check_env_file() {
    echo -e "\n${YELLOW}🔐 Verificando arquivo de ambiente...${NC}"
    
    if [ ! -f ".env.docker" ]; then
        echo -e "${RED}❌ Arquivo .env.docker não encontrado!${NC}"
        echo -e "${YELLOW}Criando template...${NC}"
        
        cat > .env.docker << 'EOF'
# Supabase Configuration
VITE_SUPABASE_URL=https://rcfmbjkolnzjhrlgrtda.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjZm1iamtvbG56amhybGdydGRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1NDE5NDEsImV4cCI6MjA3NDExNzk0MX0.By9dvWq3J93hqcgFl3GaWC8oxTejOmxbHqBt4zzAOVI
VITE_SUPABASE_PROJECT_ID=rcfmbjkolnzjhrlgrtda

# Node environment
NODE_ENV=production
EOF
        echo -e "${GREEN}✅ Arquivo .env.docker criado com valores padrão${NC}"
    else
        echo -e "${GREEN}✅ Arquivo .env.docker encontrado${NC}"
    fi
}

# Função para parar containers existentes
stop_containers() {
    echo -e "\n${YELLOW}⏹️  Parando containers existentes...${NC}"
    
    if docker ps -q --filter "name=${APP_NAME}" | grep -q .; then
        docker stop ${APP_NAME} 2>/dev/null || true
        docker rm ${APP_NAME} 2>/dev/null || true
        echo -e "${GREEN}✅ Container anterior removido${NC}"
    else
        echo -e "${BLUE}ℹ️  Nenhum container anterior encontrado${NC}"
    fi
}

# Função para limpar recursos Docker
cleanup_docker() {
    echo -e "\n${YELLOW}🗑️  Limpando recursos Docker não utilizados...${NC}"
    
    docker system prune -f --volumes 2>/dev/null || true
    docker image prune -f 2>/dev/null || true
    
    echo -e "${GREEN}✅ Limpeza concluída${NC}"
}

# Função para build da aplicação
build_app() {
    echo -e "\n${YELLOW}🔨 Construindo aplicação...${NC}"
    
    # Carregar variáveis de ambiente
    export $(grep -v '^#' .env.docker | xargs)
    
    docker build \
        --build-arg VITE_SUPABASE_URL=${VITE_SUPABASE_URL} \
        --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY} \
        --build-arg VITE_SUPABASE_PROJECT_ID=${VITE_SUPABASE_PROJECT_ID} \
        -t ${APP_NAME}:latest \
        -f Dockerfile \
        . \
        --no-cache
    
    echo -e "${GREEN}✅ Build concluído${NC}"
}

# Função para iniciar container
start_container() {
    echo -e "\n${YELLOW}🚀 Iniciando container...${NC}"
    
    docker run -d \
        --name ${APP_NAME} \
        --restart always \
        -p ${APP_PORT}:${INTERNAL_PORT} \
        -e PORT=${INTERNAL_PORT} \
        -e NODE_ENV=production \
        --memory="512m" \
        --cpus="1" \
        ${APP_NAME}:latest
    
    echo -e "${GREEN}✅ Container iniciado${NC}"
}

# Função para verificar saúde do container
health_check() {
    echo -e "\n${YELLOW}🏥 Verificando saúde da aplicação...${NC}"
    
    # Aguardar container iniciar
    sleep 10
    
    # Tentar conectar
    for i in {1..12}; do
        if curl -sf http://localhost:${APP_PORT} > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Aplicação está respondendo!${NC}"
            return 0
        fi
        echo -e "${YELLOW}⏳ Aguardando aplicação iniciar... (tentativa $i/12)${NC}"
        sleep 5
    done
    
    echo -e "${RED}❌ Aplicação não respondeu no tempo esperado${NC}"
    echo -e "${YELLOW}📋 Logs do container:${NC}"
    docker logs --tail=50 ${APP_NAME}
    return 1
}

# Função para exibir status final
show_status() {
    echo -e "\n${BLUE}=============================================${NC}"
    echo -e "${GREEN}✨ Deploy concluído com sucesso!${NC}"
    echo -e "${BLUE}=============================================${NC}"
    
    # Obter IP público
    PUBLIC_IP=$(curl -sf http://checkip.amazonaws.com 2>/dev/null || echo "localhost")
    
    echo -e "\n${YELLOW}📊 Status do Container:${NC}"
    docker ps --filter "name=${APP_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    echo -e "\n${YELLOW}🌐 Acesse a aplicação:${NC}"
    echo -e "   Local:  ${GREEN}http://localhost:${APP_PORT}${NC}"
    echo -e "   Rede:   ${GREEN}http://${PUBLIC_IP}:${APP_PORT}${NC}"
    
    echo -e "\n${YELLOW}📋 Comandos úteis:${NC}"
    echo -e "   Logs:        ${BLUE}docker logs -f ${APP_NAME}${NC}"
    echo -e "   Reiniciar:   ${BLUE}docker restart ${APP_NAME}${NC}"
    echo -e "   Parar:       ${BLUE}docker stop ${APP_NAME}${NC}"
    echo -e "   Status:      ${BLUE}docker ps${NC}"
}

# Função principal
main() {
    echo -e "\n${YELLOW}⏰ Início: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    
    check_dependencies
    check_env_file
    stop_containers
    cleanup_docker
    build_app
    start_container
    health_check
    show_status
    
    echo -e "\n${YELLOW}⏰ Fim: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
}

# Executar
main "$@"
