# 把默认的 HTTP-only 反向代理配置直接打进镜像，这样默认部署（拉取 Docker Hub 镜像）
# 不需要在宿主机上再放一份 nginx 配置文件。想用 HTTPS 的话，在 docker-compose.yml 里
# 用 volume 挂载自己改过的配置文件覆盖掉 /etc/nginx/conf.d/default.conf 即可
# （见 README「启用 HTTPS」）。
FROM nginx:1.27-alpine
COPY reverse-proxy.conf /etc/nginx/conf.d/default.conf
EXPOSE 80 443
