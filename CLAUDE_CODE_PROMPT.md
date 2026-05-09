# CLAUDE_CODE_PROMPT.md — Master Build Prompt for FrameForge

## Project Brief

Build **FrameForge** — a fully client-side, browser-based video-to-image-sequence converter web application using Next.js 14, TypeScript, and Tailwind CSS.

Read all companion files before starting:
- `DESIGN.md` — Color system, typography, component styles, animations
- `FEATURES.md` — Full feature list with detailed specs
- `TECH_STACK.md` — Framework choices, file structure, browser APIs
- `UI_UX.md` — Screen states, interaction specs, accessibility

---

## What to Build

A single-page web app where users can:
1. Upload a video (drag & drop or file picker or URL)
2. Configure extraction settings (FPS up to 120, time range, PNG/JPEG, resolution)
3. Extract frames client-side (no server uploads)
4. See live progress with frame preview thumbnails
5. Download all frames as a ZIP file

---

## Step-by-Step Build Order

### Step 1 — Project Setup
```bash
npx create-next-app@latest frameforge \
  --typescript --tailwind --eslint --app --src-dir=false
cd frameforge
npm install framer-motion zustand jszip react-range \
  @radix-ui/react-slider lucide-react sonner clsx tailwind-merge
```

### Step 2 — Design System
1. Update `app/globals.css` with all CSS variables from `DESIGN.md`
2. Update `tailwind.config.ts` to extend with custom colors matching CSS variables
3. Add Google Fonts (Orbitron, Syne, JetBrains Mono) to `app/layout.tsx`
4. Create `lib/utils.ts` with `cn()` helper (clsx + tailwind-merge)

### Step 3 — State Management
Create `store/extractorStore.ts` with Zustand:
```typescript
type ExtractionStatus = 'idle' | 'loaded' | 'extracting' | 'complete' | 'error';

interface ExtractionConfig {
  startTime: number;
  endTime: number;
  fps: number;
  format: 'png' | 'jpeg';
  quality: number; // 0–1, JPEG only
  width: number | null; // null = original
  filenamePrefix: string;
}

interface ExtractorState {
  videoFile: File | null;
  videoUrl: string | null;
  videoMeta: VideoMeta | null;
  config: ExtractionConfig;
  status: ExtractionStatus;
  progress: number; // 0–100
  currentFrame: number;
  totalFrames: number;
  frames: FrameBlob[];
  errorMessage: string | null;
  // actions
  setVideo: (file: File) => void;
  setConfig: (partial: Partial<ExtractionConfig>) => void;
  setStatus: (status: ExtractionStatus) => void;
  addFrame: (blob: Blob, index: number) => void;
  reset: () => void;
}
```

### Step 4 — Core Extraction Engine

Create `lib/extractor/CanvasExtractor.ts`:
```typescript
// Canvas-based frame extractor (universal browser support)
// Algorithm:
// 1. Create hidden <video> element with the file as src
// 2. Calculate timestamps for each frame based on FPS and time range
// 3. For each timestamp: set video.currentTime, wait for 'seeked', draw to canvas
// 4. Export canvas as blob (PNG or JPEG)
// 5. Emit progress callbacks

export async function extractFramesWithCanvas(
  videoFile: File,
  config: ExtractionConfig,
  onFrame: (blob: Blob, index: number, total: number) => void,
  onProgress: (frame: number, total: number) => void,
  cancelToken: { cancelled: boolean }
): Promise<void>
```

### Step 5 — UI Components

Build these components in order:

#### 5a. Layout Components
- `components/Navbar.tsx` — Fixed top nav, logo + links + GitHub button
- `components/Footer.tsx` — Simple dark footer

#### 5b. Upload Components
- `components/uploader/DropZone.tsx`
  - Animated glow border (CSS keyframe pulse)
  - Drag/drop handlers + file input fallback
  - URL input field below zone
  - Accepted formats label

- `components/uploader/VideoPreview.tsx`
  - HTML5 video player
  - File metadata sidebar (name, size, resolution, duration)
  - "Load Different Video" button

#### 5c. Settings Components
- `components/settings/TimeRangeSelector.tsx`
  - Dual-handle slider using `react-range`
  - Start/end time number inputs
  - Live "N frames" count display

- `components/settings/FPSControl.tsx`
  - Preset buttons: [1][6][12][24][30][60][120]
  - Custom slider (1–120)
  - Numeric input
  - Frame count summary
  - High-count warning badge

- `components/settings/FormatSelector.tsx`
  - PNG / JPEG pill toggle
  - JPEG quality slider (animates in when JPEG selected)

- `components/settings/ResolutionSelector.tsx`
  - Custom styled select dropdown
  - Options: Original, 1920px, 1280px, 854px

- `components/settings/MoreOptions.tsx`
  - Collapsible with Framer Motion AnimatePresence
  - Filename prefix input
  - ZIP compression toggle

- `components/settings/SettingsPanel.tsx`
  - Wrapper that renders all settings
  - Slides down with animation after video loads

#### 5d. Extraction Components
- `components/extractor/ExtractionProgress.tsx`
  - Neon progress bar (see DESIGN.md for CSS)
  - "Frame X of Y — Z%" text
  - ETA display
  - Cancel button

- `components/extractor/FramePreviewGrid.tsx`
  - Responsive grid of frame thumbnails
  - Thumbnails animate in as extracted
  - Click to open in full-screen modal

- `components/extractor/ExtractButton.tsx`
  - Big CTA button with frame count in label
  - Disabled state with explanation when config is invalid
  - Loading state during extraction

#### 5e. Export Components
- `components/export/DownloadCard.tsx`
  - ZIP size estimate display
  - Download button that triggers JSZip build + download
  - "Extract Another Video" reset button

### Step 6 — ZIP Builder
Create `lib/zipBuilder.ts`:
```typescript
import JSZip from 'jszip';

export async function buildZip(
  frames: { blob: Blob; filename: string }[],
  onProgress: (percent: number) => void
): Promise<Blob>

// Use JSZip in streaming mode for large archives
// Filename format: frame_0001.png (zero-padded based on total count)
// ZIP filename: frameforge_[Date.now()].zip
```

### Step 7 — Main Page Assembly
`app/page.tsx` — orchestrates all states:
```
{status === 'idle' && <HeroSection />}
{status === 'idle' && <DropZone />}
{status !== 'idle' && <VideoPreview />}
{status === 'loaded' && <SettingsPanel />}
{status === 'loaded' && <ExtractButton />}
{status === 'extracting' && <ExtractionProgress />}
{status === 'extracting' && <FramePreviewGrid />}
{status === 'complete' && <DownloadCard />}
{status === 'complete' && <FramePreviewGrid />}
<HowItWorksSection />
```

### Step 8 — Hero Section
`components/HeroSection.tsx`:
- Title: "FRAMEFORGE" in Orbitron font, large, wide-tracked
- Subtitle: "Video → Frame Sequence Converter"
- Description: 2-line pitch
- Background: radial cyan glow at top (see DESIGN.md)
- Stats bar: "120 FPS | IN-BROWSER | PNG + JPEG | FREE"

### Step 9 — Polish & Animations
- Add page load stagger animation (navbar → hero → dropzone)
- Add scanline texture overlay to hero background
- Ensure all hover states have glow effects
- Add toast notifications (Sonner) for:
  - Video loaded successfully
  - Unsupported format error
  - High frame count warning
  - Extraction complete
  - Download started

### Step 10 — How It Works Section
Collapsible section with 4-step explanation (see UI_UX.md)

---

## Critical Implementation Notes

### Frame Extraction Algorithm (Canvas method)
```typescript
const timestamps: number[] = [];
const frameInterval = 1 / config.fps;
for (let t = config.startTime; t < config.endTime; t += frameInterval) {
  timestamps.push(t);
}

for (let i = 0; i < timestamps.length; i++) {
  if (cancelToken.cancelled) break;
  
  await seekVideoTo(video, timestamps[i]); // returns Promise resolved on 'seeked'
  
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await canvasToBlob(canvas, config.format, config.quality);
  
  onFrame(blob, i, timestamps.length);
  onProgress(i + 1, timestamps.length);
}
```

### Zero-Padding Filenames
```typescript
const padLength = String(totalFrames).length;
const filename = `${prefix}${String(index + 1).padStart(padLength, '0')}.${format}`;
// e.g. frame_0001.png, frame_0298.png
```

### Memory Management
- Store frames as `{ blob: Blob; objectUrl: string; index: number }[]`
- Revoke object URLs when component unmounts
- Warn if frame count * estimated frame size > 500MB

### Browser API Detection
```typescript
const hasWebCodecs = typeof window !== 'undefined' && 'VideoDecoder' in window;
// Use WebCodecs if available, otherwise fall back to canvas method
```

---

## Design Implementation Checklist

From `DESIGN.md`, ensure these are implemented:

- [ ] CSS variables for all colors in `globals.css`
- [ ] Orbitron font for logo and hero title  
- [ ] Syne font for all body/UI text
- [ ] JetBrains Mono for numbers and stats
- [ ] Progress bar with neon glow + moving bright tip
- [ ] Drop zone with pulse animation + hover glow
- [ ] Primary button with border glow style (NOT filled background)
- [ ] Radial cyan glow in hero background (`::before` pseudo-element)
- [ ] Subtle scanline texture overlay
- [ ] Stats bar below hero section
- [ ] Sharp (2px) border-radius on cards (not rounded-xl)
- [ ] All interactive elements have `translateY(-2px)` hover lift
- [ ] Frame thumbnails have cyan border glow on hover

---

## File Structure to Create

```
frameforge/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── Navbar.tsx
│   ├── Footer.tsx
│   ├── HeroSection.tsx
│   ├── HowItWorksSection.tsx
│   ├── uploader/
│   │   ├── DropZone.tsx
│   │   └── VideoPreview.tsx
│   ├── settings/
│   │   ├── SettingsPanel.tsx
│   │   ├── TimeRangeSelector.tsx
│   │   ├── FPSControl.tsx
│   │   ├── FormatSelector.tsx
│   │   ├── ResolutionSelector.tsx
│   │   └── MoreOptions.tsx
│   ├── extractor/
│   │   ├── ExtractButton.tsx
│   │   ├── ExtractionProgress.tsx
│   │   └── FramePreviewGrid.tsx
│   └── export/
│       └── DownloadCard.tsx
├── store/
│   └── extractorStore.ts
├── lib/
│   ├── utils.ts
│   ├── extractor.ts
│   └── zipBuilder.ts
└── types/
    └── index.ts
```

---

## Start Command

```bash
npm run dev
```

Open at http://localhost:3000

---

## Definition of Done

The app is complete when:
- [ ] User can drag & drop an MP4 and see video preview
- [ ] FPS slider goes from 1 to 120 with correct frame count shown
- [ ] Time range selector correctly limits extraction segment
- [ ] Clicking "Extract Frames" starts the canvas extraction loop
- [ ] Progress bar updates per frame with accurate percentage
- [ ] Frame thumbnails appear in grid during extraction
- [ ] After completion, "Download ZIP" generates and downloads a valid ZIP
- [ ] ZIP contains correctly named sequential PNG/JPEG files
- [ ] UI matches the dark cyan design from DESIGN.md
- [ ] Page is responsive down to 768px wide
- [ ] All animations from DESIGN.md are implemented
