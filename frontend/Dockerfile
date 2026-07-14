# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
# CI 构建时通过 --build-arg VITE_GIT_COMMIT=<sha> 注入，构建时会被 Vite 静态打进产物里，
# 「账户设置」页面显示这个值，方便确认打开的页面是不是已经是最新一次推送构建出来的
# （见 src/version.ts）。
ARG VITE_GIT_COMMIT=dev
ENV VITE_GIT_COMMIT=$VITE_GIT_COMMIT
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

# ---- runtime stage ----
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
