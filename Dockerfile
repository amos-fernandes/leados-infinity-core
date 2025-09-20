# Etapa 1: build
FROM node:18 as builder
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build

# Etapa 2: servir com 'serve'
FROM node:18-slim
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist /app/dist
EXPOSE 8080
CMD ["sh", "-c", "serve -s dist -l ${PORT:-8080}"]
