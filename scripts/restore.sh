#!/bin/sh
# 从备份文件恢复数据库（脚本已经打进 backup 镜像里了，不需要额外挂载）。用法：
#   docker compose run --rm backup /scripts/restore.sh /backups/backup_xxx.sql.gz
set -e

FILE="$1"
if [ -z "$FILE" ]; then
  echo "用法: restore.sh <备份文件路径.sql.gz>"
  exit 1
fi

echo "[restore] 即将从 $FILE 恢复数据库 $POSTGRES_DB，此操作会覆盖现有数据"
gunzip -c "$FILE" | PGPASSWORD="$POSTGRES_PASSWORD" psql -h "${PGHOST:-postgres}" -U "$POSTGRES_USER" -d "$POSTGRES_DB"
echo "[restore] 恢复完成"
