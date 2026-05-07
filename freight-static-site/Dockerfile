# Coolify: build with Dockerfile, expose port 80, or use static deployment with `npm run build` + `dist` as publish directory.
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
# `npm ci` can fail across npm/OS versions when the lockfile omits nested deps; `npm install` is more tolerant for Docker builds.
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
