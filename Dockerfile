# Etapa 1: build
FROM node:18 AS builder
WORKDIR /app

# Aceita variáveis de ambiente como build args
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID

# Define as variáveis de ambiente para o build
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID

# Copia apenas package.json primeiro para cache de dependências
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copia o resto dos arquivos e faz o build
COPY . .
RUN npm run build

# Etapa 2: servir com 'serve' (imagem mínima)
FROM node:18-slim
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist /app/dist
EXPOSE 8080
CMD ["sh", "-c", "serve -s dist -l ${PORT:-8080}"]
