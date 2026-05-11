# Production web — Vite build + nginx (SPA)
#
# Build context must be the repository root (not ./web) so the file behind
# @brs/suggested-mapping (api/src/services/suggestedMapping.ts) exists at
# ../api/... relative to the web app, matching tsconfig.app.json and vite.config.ts.
FROM node:20-alpine AS builder
WORKDIR /app
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
COPY web/package*.json ./
RUN npm ci
COPY web/ .
COPY api/src/services/suggestedMapping.ts /api/src/services/suggestedMapping.ts
RUN npm run build

FROM nginx:alpine
COPY web/nginx.default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
