import nodemailer from "nodemailer";
import { env } from "../config/env";

const transporter = nodemailer.createTransport({
  host: env.smtpHost,
  port: env.smtpPort,
  secure: env.smtpSecure,
  auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
});

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  if (!env.smtpHost) {
    console.warn(`[mailer] 未配置 SMTP，跳过发送邮件。重置链接: ${resetUrl}`);
    return;
  }
  await transporter.sendMail({
    from: env.mailFrom,
    to,
    subject: "重置您的密码 - 车辆保养管理",
    html: `<p>您好，</p><p>请点击以下链接重置密码，链接 30 分钟内有效：</p>
           <p><a href="${resetUrl}">${resetUrl}</a></p>
           <p>如果这不是您本人的操作，请忽略此邮件。</p>`,
  });
}
