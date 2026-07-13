#!/bin/sh
# 定时全量备份 PostgreSQL 数据库到 /backups 目录，并清理超过 BACKUP_KEEP_DAYS 天的旧备份。
set -e

BACKUP_DIR=/backups
mkdir -p "$BACKUP_DIR"

INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"

echo "[backup] 备份服务已启动，每 ${INTERVAL} 秒执行一次，保留最近 ${KEEP_DAYS} 天"

while true; do
  TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
  FILE="$BACKUP_DIR/backup_${TIMESTAMP}.sql.gz"
  echo "[backup] 开始备份到 $FILE"
  PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h "${PGHOST:-postgres}" -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$FILE"
  echo "[backup] 备份完成"

  find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +"$KEEP_DAYS" -delete

  sleep "$INTERVAL"
done
