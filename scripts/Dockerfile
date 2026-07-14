# 把备份/恢复脚本打进镜像，这样默认部署（拉取 Docker Hub 镜像）不需要在宿主机上
# 再放一份 scripts 目录。
#
# ENTRYPOINT 清空、只用 CMD 指定默认命令（backup.sh 循环备份），这样
# `docker compose run --rm backup /scripts/restore.sh <file>` 才能正确地把默认命令
# 换成 restore.sh，而不是被固定的 entrypoint 吞掉、实际还是在跑 backup.sh。
FROM postgres:16-alpine
COPY backup.sh restore.sh /scripts/
RUN chmod +x /scripts/backup.sh /scripts/restore.sh
ENTRYPOINT []
CMD ["/scripts/backup.sh"]
