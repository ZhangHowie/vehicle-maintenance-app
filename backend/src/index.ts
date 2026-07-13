import app from "./app";
import { env } from "./config/env";
import { ensureDefaultAdmin } from "./utils/seedAdmin";

async function main() {
  await ensureDefaultAdmin();
  app.listen(env.port, () => {
    console.log(`后端服务已启动，监听端口 ${env.port} (${env.nodeEnv})`);
  });
}

main().catch((err) => {
  console.error("启动失败:", err);
  process.exit(1);
});
