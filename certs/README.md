将 SSL 证书文件放置在此目录：

- fullchain.pem  （证书链，包含服务器证书 + 中间证书）
- privkey.pem    （私钥）

放置完成后，将 nginx/reverse-proxy.https.conf.example 复制为
nginx/reverse-proxy.conf，再执行：

    docker compose restart nginx

即可启用 HTTPS。
