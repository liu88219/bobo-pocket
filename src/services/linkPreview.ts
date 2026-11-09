import { SourcePlatform } from '../types/pocket';
import { detectPlatform } from './spotParser';

/**
 * 盡力而為的公開連結預覽（免金鑰）：
 * - Threads / 一般網頁：透過公開 CORS 代理抓 og:title / og:description / og:image
 * - YouTube / TikTok 等：noembed.com（支援 CORS）
 * - Instagram：常被登入牆擋住，抓不到時 UI 會引導貼文案或上傳截圖
 */

export interface LinkPreview {
  platform: SourcePlatform;
  title?: string;
  description?: string;
  image?: string;
  author?: string;
  /** 預覽圖經代理下載並縮圖後的 data URL（可長期保存） */
  imageDataUrl?: string;
  via?: string;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    return await fetch(url, { ...init, signal: ctrl?.signal });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

type ProxyStrategy = {
  name: string;
  build: (target: string) => string;
  parse: (res: Response) => Promise<string>;
};

const HTML_PROXIES: ProxyStrategy[] = [
  {
    name: 'allorigins',
    build: (t) => `https://api.allorigins.win/get?url=${encodeURIComponent(t)}&t=${Date.now()}`,
    parse: async (res) => {
      const json = (await res.json()) as { contents?: string };
      return json?.contents || '';
    },
  },
  {
    name: 'codetabs',
    build: (t) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(t)}`,
    parse: (res) => res.text(),
  },
  {
    name: 'corsproxy',
    build: (t) => `https://corsproxy.io/?url=${encodeURIComponent(t)}`,
    parse: (res) => res.text(),
  },
];

function decodeHtmlEntities(s: string): string {
  if (!s) return s;
  if (typeof document === 'undefined') {
    return s
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }
  const el = document.createElement('textarea');
  el.innerHTML = s;
  return el.value;
}

export function parseOpenGraph(html: string): { title?: string; description?: string; image?: string } {
  const pick = (prop: string): string | undefined => {
    const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, 'i');
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, 'i');
    const m = re1.exec(html) || re2.exec(html);
    return m ? decodeHtmlEntities(m[1]).trim() : undefined;
  };
  const title = pick('og:title') || pick('twitter:title') || (/<title[^>]*>([^<]{1,200})<\/title>/i.exec(html)?.[1] || '').trim() || undefined;
  const description = pick('og:description') || pick('twitter:description') || pick('description');
  const image = pick('og:image') || pick('twitter:image');
  return { title, description, image };
}

function looksLikeLoginWall(title?: string, description?: string): boolean {
  const t = `${title || ''} ${description || ''}`.toLowerCase();
  return (
    t.includes('log in') && (t.includes('instagram') || t.includes('facebook')) && !t.includes('"')
  ) || /登入.*instagram|instagram.*登入/.test(t);
}

async function fetchHtmlViaProxies(target: string): Promise<{ html: string; via: string } | null> {
  for (const p of HTML_PROXIES) {
    try {
      const res = await fetchWithTimeout(p.build(target), { method: 'GET' }, 9000);
      if (!res.ok) continue;
      const html = await p.parse(res);
      if (html && html.length > 200) return { html, via: p.name };
    } catch {
      // try next proxy
    }
  }
  return null;
}

async function fetchNoembed(target: string): Promise<Partial<LinkPreview> | null> {
  try {
    const res = await fetchWithTimeout(`https://noembed.com/embed?url=${encodeURIComponent(target)}`, {}, 8000);
    if (!res.ok) return null;
    const json = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string; error?: string };
    if (json.error) return null;
    return { title: json.title, author: json.author_name, image: json.thumbnail_url, via: 'noembed' };
  } catch {
    return null;
  }
}

/** 透過代理下載圖片並縮成小封面（避免 IG CDN 簽名網址過期） */
export async function fetchImageAsThumb(imageUrl: string, maxDim = 640, quality = 0.78): Promise<string | undefined> {
  const candidates = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(imageUrl)}`,
    `https://corsproxy.io/?url=${encodeURIComponent(imageUrl)}`,
    imageUrl,
  ];
  for (const url of candidates) {
    try {
      const res = await fetchWithTimeout(url, { method: 'GET' }, 9000);
      if (!res.ok) continue;
      const blob = await res.blob();
      if (!blob.type.startsWith('image/') && blob.size < 1000) continue;
      const dataUrl = await blobToThumbDataUrl(blob, maxDim, quality);
      if (dataUrl) return dataUrl;
    } catch {
      // next
    }
  }
  return undefined;
}

export async function blobToThumbDataUrl(blob: Blob, maxDim: number, quality: number): Promise<string | undefined> {
  try {
    const bitmap = await createImageBitmap(blob);
    let w = bitmap.width;
    let h = bitmap.height;
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
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return undefined;
  }
}

export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreview> {
  const url = rawUrl.trim();
  const platform = detectPlatform(url);
  const result: LinkPreview = { platform };
  if (!/^https?:\/\//i.test(url)) return result;

  if (platform === 'youtube' || platform === 'tiktok' || platform === 'facebook') {
    const ne = await fetchNoembed(url);
    if (ne) Object.assign(result, ne);
  }

  if (!result.title) {
    const page = await fetchHtmlViaProxies(url);
    if (page) {
      const og = parseOpenGraph(page.html);
      if (!looksLikeLoginWall(og.title, og.description)) {
        result.title = og.title;
        result.description = og.description;
        result.image = og.image;
        result.via = page.via;
      }
    }
  }

  if (result.title && platform === 'instagram') {
    const m = /^(.+?) on Instagram/.exec(result.title);
    if (m) result.author = m[1].trim();
  }
  if (result.title && platform === 'threads') {
    const m = /\(@([A-Za-z0-9_.]+)\)/.exec(result.title);
    if (m) result.author = m[1];
  }

  if (result.image) {
    result.imageDataUrl = await fetchImageAsThumb(result.image);
  }
  return result;
}
