# Etapa 1: Compilación de React con Node.js
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar dependencias y asegurar instalación limpia
COPY package*.json ./
RUN npm install

# Copiar todo el código fuente
COPY . .

# Argumentos de construcción (Vite necesita estas variables durante el build)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_BASE_PATH=/
ARG VITE_GEMINI_API_KEY

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_BASE_PATH=$VITE_BASE_PATH
ENV VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY

# Compilar la aplicación a la carpeta dist
RUN npm run build

# Etapa 2: Servidor Nginx ultra-ligero y optimizado para producción
FROM nginx:alpine

# Copiar los archivos compilados de React
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar la configuración personalizada de Nginx para SPA (React Router)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
