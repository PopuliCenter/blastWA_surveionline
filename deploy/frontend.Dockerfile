# Build dashboard (React + Vite) lalu sajikan via Nginx + proxy ke backend.
# Context build = root repo. Lihat deploy/docker-compose.prod.yml.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Origin API = sama dengan domain publik (Nginx kontainer ini yang proxy /api).
ARG VITE_API_URL=https://wa.populicenter.com
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY deploy/frontend.nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
