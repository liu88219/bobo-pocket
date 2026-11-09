/**
 * 圖片工具：HEIC 友善解碼、雙尺寸縮圖（本機高清 + 雲端分片縮圖）、瀏覽器本地 OCR（按需載入）
 */

export interface ProcessedImage {
  /** 同步進雲端分片與卡片顯示的縮圖（~640px，約 30–60KB） */
  thumb: string;
  /** 本機 IndexedDB 保存的較高畫質版本（~1280px） */
  hiRes: string;
}

type DrawableSource = HTMLImageElement | ImageBitmap;

function getDims(src: DrawableSource): { w: number; h: number } {
  if ('naturalWidth' in src) return { w: src.naturalWidth || src.width, h: src.naturalHeight || src.height };
  return { w: src.width, h: src.height };
}

async function loadImageSource(file: File | Blob): Promise<DrawableSource> {
  const name = 'name' in file ? (file as File).name : '';
  const isHeic = /\.(heic|heif)$/i.test(name || '') || /image\/(heic|heif)/i.test(file.type || '');
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const el = new Image();
      el.onload = () => {
        URL.revokeObjectURL(url);
        resolve(el);
      };
      el.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('img_decode_failed'));
      };
      el.src = url;
    });
  } catch {
    if (typeof createImageBitmap === 'function') {
      try {
        return await createImageBitmap(file);
      } catch {
        // fall through
      }
    }
    if (isHeic) {
      throw new Error('這張是 iPhone HEIC 原況格式，瀏覽器無法直接讀取～先截圖再上傳就可以囉 📸');
    }
    throw new Error('無法讀取這張圖片，換一張或先截圖試試 📸');
  }
}

function resizeContain(src: DrawableSource, maxDim: number, quality: number): string {
  const { w: ow, h: oh } = getDims(src);
  let w = ow;
  let h = oh;
  if (w > maxDim || h > maxDim) {
    if (w >= h) {
      h = Math.round((h * maxDim) / w);
      w = maxDim;
    } else {
      w = Math.round((w * maxDim) / h);
      h = maxDim;
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, w);
  canvas.height = Math.max(1, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas_unavailable');
  ctx.fillStyle = '#FAF8F3';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(src, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

export async function processImageFile(file: File | Blob): Promise<ProcessedImage> {
  const src = await loadImageSource(file);
  let thumb = resizeContain(src, 640, 0.76);
  if (thumb.length > 70000) thumb = resizeContain(src, 520, 0.68);
  if (thumb.length > 70000) thumb = resizeContain(src, 420, 0.62);
  const hiRes = resizeContain(src, 1280, 0.82);
  return { thumb, hiRes };
}

/** 從影片檔擷取 3 張畫格（開頭／中段／尾段），回傳縮圖 data URL */
export async function extractVideoFrames(file: File | Blob, count = 3): Promise<string[]> {
  return new Promise<string[]>((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    const frames: string[] = [];
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = url;
    const cleanup = () => {
      URL.revokeObjectURL(url);
      resolve(frames);
    };
    const timer = setTimeout(cleanup, 20000);
    video.onerror = () => {
      clearTimeout(timer);
      cleanup();
    };
    video.onloadedmetadata = async () => {
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
      const points = Array.from({ length: count }, (_, i) => Math.min(duration - 0.05, (duration * (i + 0.5)) / count));
      for (const t of points) {
        await new Promise<void>((done) => {
          video.onseeked = () => {
            try {
              const canvas = document.createElement('canvas');
              const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
              canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
              canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                frames.push(canvas.toDataURL('image/jpeg', 0.74));
              }
            } catch {
              // ignore frame failure
            }
            done();
          };
          video.currentTime = Math.max(0, t);
        });
      }
      clearTimeout(timer);
      cleanup();
    };
  });
}

type TesseractModule = {
  recognize?: (image: string, langs: string, options?: Record<string, unknown>) => Promise<{ data?: { text?: string } }>;
  default?: {
    recognize?: (image: string, langs: string, options?: Record<string, unknown>) => Promise<{ data?: { text?: string } }>;
  };
};

let tesseractPromise: Promise<TesseractModule> | null = null;

/**
 * 瀏覽器本地 OCR（tesseract.js 按需從 CDN 載入，首次需下載繁中模型約 20–40 秒；零伺服器、零額度）
 */
export async function recognizeTextFromImage(
  dataUrl: string,
  onProgress?: (msg: string) => void
): Promise<string> {
  if (!tesseractPromise) {
    onProgress?.('首次載入文字辨識引擎中…');
    const cdnUrl = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/+esm';
    tesseractPromise = import(/* @vite-ignore */ cdnUrl) as Promise<TesseractModule>;
  }
  const mod = await tesseractPromise;
  const recognizeFn = mod.recognize || mod.default?.recognize;
  if (!recognizeFn) throw new Error('OCR 引擎載入失敗');
  onProgress?.('辨識截圖文字中（首次需下載繁中模型）…');
  const res = await recognizeFn(dataUrl, 'chi_tra+eng', {
    logger: (m: { status?: string; progress?: number }) => {
      if (m?.status && typeof m.progress === 'number') {
        onProgress?.(`${m.status} ${Math.round(m.progress * 100)}%`);
      }
    },
  });
  return (res?.data?.text || '').replace(/[ \t]+/g, ' ').trim();
}
