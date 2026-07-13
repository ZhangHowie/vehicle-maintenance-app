import React, { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import { Modal, Slider, Upload, Button, message, Spin } from "antd";
import { UploadOutlined } from "@ant-design/icons";

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  onCropped: (file: File) => void;
}

// 车辆封面统一固定为 16:9，并在这里把裁剪结果真正"烤"进图片像素（而不仅仅是记录裁剪范围），
// 这样无论在车辆列表卡片、详情页横幅还是以后的移动端，只要显示容器也是 16:9，
// 呈现的画面范围就和用户在这里框选的完全一致，不会出现"上传比例和显示比例对不上"的问题。
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = src;
  });
}

async function bakeCroppedFile(
  imageSrc: string,
  area: CropArea,
  fileName: string,
  mimeType: string
): Promise<File> {
  const img = await loadImage(imageSrc);
  const maxWidth = 1280;
  const outWidth = Math.max(1, Math.min(Math.round(area.width), maxWidth));
  const outHeight = Math.round((outWidth * 9) / 16);

  const canvas = document.createElement("canvas");
  canvas.width = outWidth;
  canvas.height = outHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("当前浏览器不支持图片裁剪");
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, outWidth, outHeight);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("裁剪图片生成失败"));
          return;
        }
        resolve(new File([blob], fileName, { type: mimeType }));
      },
      mimeType,
      0.9
    );
  });
}

function isHeic(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
}

// Mac / iPhone 拍摄的照片默认是 HEIC 格式，浏览器（包括 Safari）都无法直接解码预览，
// 需要先在浏览器端转成 JPEG，否则选择照片后裁剪预览会失败，表现为"选择不了"。
async function convertHeicToJpeg(file: File): Promise<File> {
  const heic2any = (await import("heic2any")).default;
  const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  const blob = Array.isArray(result) ? result[0] : result;
  const newName = file.name.replace(/\.(heic|heif)$/i, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg" });
}

export default function ImageCropUpload({ onCropped }: Props) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [open, setOpen] = useState(false);
  const [converting, setConverting] = useState(false);
  const [processing, setProcessing] = useState(false);

  async function handleFile(file: File) {
    let workingFile = file;

    if (isHeic(file)) {
      setConverting(true);
      try {
        workingFile = await convertHeicToJpeg(file);
      } catch {
        message.error("这张照片（HEIC 格式）转换失败，换一张试试，或先在系统相册里导出为 JPEG/PNG");
        setConverting(false);
        return false;
      }
      setConverting(false);
    }

    setOriginalFile(workingFile);
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setOpen(true);
    };
    reader.onerror = () => {
      message.error("图片读取失败，请换一张图片");
    };
    reader.readAsDataURL(workingFile);
    return false; // 阻止 antd Upload 自动上传
  }

  const onCropComplete = useCallback((_area: unknown, areaPixels: CropArea) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  async function handleOk() {
    if (!originalFile || !croppedAreaPixels || !imageSrc) {
      message.error("请先选择封面裁剪范围");
      return;
    }
    setProcessing(true);
    try {
      const mimeType = originalFile.type === "image/png" ? "image/png" : "image/jpeg";
      const ext = mimeType === "image/png" ? ".png" : ".jpg";
      const baseName = originalFile.name.replace(/\.[^.]+$/, "");
      const croppedFile = await bakeCroppedFile(imageSrc, croppedAreaPixels, `${baseName}${ext}`, mimeType);
      onCropped(croppedFile);
      setOpen(false);
      setImageSrc(null);
    } catch {
      message.error("裁剪处理失败，请重试");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <>
      <Upload
        beforeUpload={handleFile}
        showUploadList={false}
        accept="image/*,.heic,.heif"
      >
        <Button icon={<UploadOutlined />} loading={converting}>
          {converting ? "正在转换照片格式…" : "选择车辆封面图片"}
        </Button>
      </Upload>

      <Modal
        title="调整封面显示范围（拖动图片可平移，滑块可缩放）"
        open={open}
        onOk={handleOk}
        onCancel={() => !processing && setOpen(false)}
        confirmLoading={processing}
        okText="确定"
        cancelText="取消"
        maskClosable={!processing}
        closable={!processing}
        width={420}
      >
        <div style={{ position: "relative", width: "100%", height: 320, background: "#333" }}>
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={16 / 9}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          ) : (
            <Spin style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }} />
          )}
        </div>
        <div style={{ marginTop: 16 }}>
          <span>缩放：</span>
          <Slider min={1} max={3} step={0.1} value={zoom} onChange={setZoom} />
        </div>
        <div style={{ marginTop: 4, color: "#999", fontSize: 12 }}>
          封面统一按 16:9 裁剪并保存，车辆列表、详情页会按同样的比例展示，不会再走样。
        </div>
      </Modal>
    </>
  );
}
