# TECH_STACK.md — BistroSeq Technology Stack

## Architecture Philosophy

> **Zero-server. Zero-latency. Artisanal quality.**  
> BistroSeq is a fully static single-page application. All processing happens in the browser. No backend, no uploads to a server, no API keys needed.

---

## Frontend Framework

| Layer | Choice | Reason |
|---|---|---|
| Framework | **Next.js 16 (App Router)** | Modern, static export capable, React 19 support |
| Language | **TypeScript** | Type safety for complex state (extraction config, worker messages) |
| Styling | **Tailwind CSS v4** | Latest utility-first styling with modern features |
| Animation | **Framer Motion** | Elegant UI transitions and progress animations |
| Icons | **Lucide React** | Clean, consistent icon set |

---

## Core Processing APIs

### Primary: WebCodecs API
```typescript
// Available in Chrome 94+, Edge 94+
// Hardware-accelerated video decoding
const decoder = new VideoDecoder({
  output: (frame) => { /* draw to canvas */ },
  error: (e) => { /* fallback */ }
});
```
- Use for: Fast frame extraction on supported browsers
- Fallback: Canvas seek method

### Fallback: Canvas Seek Method
```typescript
// Universal browser support
video.currentTime = targetTimestamp;
video.addEventListener('seeked', () => {
  ctx.drawImage(video, 0, 0, width, height);
  canvas.toBlob(callback, 'image/png');
});
```
- Use for: Firefox, Safari, older Chrome
- Speed: ~2–5 FPS extraction throughput (acceptable for < 60 FPS jobs)

### Web Workers
```typescript
// worker.ts — runs extraction loop off main thread
self.postMessage({ type: 'progress', frame: n, total: N });
self.postMessage({ type: 'frame', blob: frameBlob, index: n });
```

---

## ZIP Generation

**JSZip v3.10**
```typescript
import JSZip from 'jszip';
const zip = new JSZip();
zip.file(`frame_0001.png`, frameBlob);
const content = await zip.generateAsync({ type: 'blob' });
```

- Streaming mode: `JSZip.generateInternalStream` for large archives
- Compression: `DEFLATE` for JPEG (small gain), `STORE` for PNG (already compressed)

---

## State Management

**Zustand** (lightweight, no boilerplate)
```typescript
const useExtractorStore = create<ExtractorState>((set) => ({
  videoFile: null,
  config: defaultConfig,
  status: 'idle',
  frames: [],
  progress: 0,
  setConfig: (c) => set({ config: c }),
  // ...
}));
```

---

## UI Components

| Component | Library | Notes |
|---|---|---|
| Slider | **Radix UI Slider** + custom styles | Accessible, styleable |
| Range Slider (timeline) | **react-range** | Dual-handle for start/end time |
| Toasts / Notifications | **Sonner** | Modern toast library |
| Modal | Custom (Framer Motion) | Full-screen frame preview |
| Progress | Custom CSS + Framer Motion | Neon glow animated bar |

---

## File Structure

```
frameforge/
├── app/
│   ├── layout.tsx          # Root layout, fonts, metadata
│   ├── page.tsx            # Main page
│   └── globals.css         # CSS variables, base styles
├── components/
│   ├── ui/
│   │   ├── GlowButton.tsx
│   │   ├── NeonProgress.tsx
│   │   ├── GlowSlider.tsx
│   │   └── FramePreviewGrid.tsx
│   ├── uploader/
│   │   ├── DropZone.tsx
│   │   └── VideoPreview.tsx
│   ├── settings/
│   │   ├── SettingsPanel.tsx
│   │   ├── FPSControl.tsx
│   │   ├── TimeRangeSelector.tsx
│   │   ├── FormatSelector.tsx
│   │   └── ResolutionSelector.tsx
│   ├── extractor/
│   │   ├── ExtractionEngine.ts
│   │   ├── WebCodecsExtractor.ts
│   │   ├── CanvasExtractor.ts
│   │   └── extractor.worker.ts
│   └── export/
│       ├── ZipBuilder.ts
│       └── DownloadButton.tsx
├── store/
│   └── extractorStore.ts
├── lib/
│   ├── utils.ts
│   ├── formatUtils.ts
│   └── videoUtils.ts
├── types/
│   └── index.ts
└── public/
    └── fonts/
```

---

## Build & Deployment

| Tool | Purpose |
|---|---|
| **Next.js static export** | `next build && next export` → pure HTML/CSS/JS |
| **Vercel** (recommended) | Zero-config deployment, CDN, free tier |
| **Cloudflare Pages** | Alternative, excellent edge performance |
| **GitHub Pages** | Free, requires base path config |

### Key next.config.js settings
```javascript
const nextConfig = {
  output: 'export',           // Static HTML export
  webpack: (config) => {
    config.resolve.fallback = { fs: false };  // No Node.js in browser
    return config;
  },
};
```

---

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---|---|---|---|---|
| Canvas extraction | ✅ | ✅ | ✅ | ✅ |
| WebCodecs (fast path) | ✅ 94+ | ⚠️ 130+ | ❌ | ✅ 94+ |
| Web Workers | ✅ | ✅ | ✅ | ✅ |
| JSZip download | ✅ | ✅ | ✅ | ✅ |

**Recommended**: Chrome/Edge for best performance (WebCodecs hardware acceleration).

---

## Performance Targets

| Scenario | Target |
|---|---|
| 10s video @ 30 FPS (300 frames) | < 20 seconds |
| 10s video @ 60 FPS (600 frames) | < 40 seconds |
| 10s video @ 120 FPS (1200 frames) | < 90 seconds |
| ZIP generation for 300 PNG frames | < 5 seconds |
| UI remains responsive during extraction | Always (Web Worker) |

---

## Dependencies (package.json)

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "typescript": "^5.4.0",
    "tailwindcss": "^3.4.0",
    "framer-motion": "^11.0.0",
    "zustand": "^4.5.0",
    "jszip": "^3.10.1",
    "react-range": "^1.8.14",
    "@radix-ui/react-slider": "^1.1.2",
    "lucide-react": "^0.400.0",
    "sonner": "^1.4.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.3.0"
  }
}
```
