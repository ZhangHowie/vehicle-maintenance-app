import speakeasy from "speakeasy";
import QRCode from "qrcode";

export function generateTotpSecret(label: string) {
  return speakeasy.generateSecret({ name: `车辆保养管理 (${label})`, length: 20 });
}

export async function generateQrCodeDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl);
}

export function verifyTotpToken(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token,
    window: 1,
  });
}
