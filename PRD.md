# PRD — BistroSeq: Artisanal Video to Image Sequence Converter

## 1. Product Overview

**BistroSeq** is an elegant, browser-based tool that allows creators, developers, and 3D web artists to transform cinematic videos into premium PNG/JPEG image sequences — downloadable as a ZIP archive. Inspired by the classic menu card, it offers a warm, high-end experience with support for up to **120 FPS** extraction and a blazing-fast client-side processing pipeline.

> Inspired by the gap in tools like ezgif.com: limited to 30 FPS, painfully slow uploads, and no real-time feedback. BistroSeq fills that gap with a premium local-first experience.

---

## 2. Problem Statement

| Pain Point (ezgif) | FrameForge Solution |
|---|---|
| Max 30 FPS extraction | Up to 120 FPS |
| Server-side processing (slow upload) | 100% client-side via WebCodecs / Canvas API |
| No real-time preview | Live frame preview grid as extraction runs |
| No progress feedback | Per-frame progress bar + ETA |
| Only ZIP of PNG | ZIP of PNG **or** JPEG with quality control |
| No batch segment control | Precise start/end time with visual scrubber |

---

## 3. Target Users

1. **3D Web Developers** — Building scroll-driven cinematic websites (e.g., Apple-style), need frame sequences for canvas animation.
2. **Creative Coders** — Artists building WebGL / Three.js experiences with video-driven textures.
3. **Motion Designers** — Extracting specific frames for reference or compositing.
4. **AI/ML Engineers** — Need frames from video for training data.

---

## 4. Goals & Success Metrics

### Goals
- Zero-server architecture: all processing runs in the browser
- Support extraction up to 120 FPS
- Process a 10-second 1080p video in under 15 seconds
- Intuitive drag-and-drop first experience
- Output a clean ZIP archive with sequentially named files

### KPIs
- Time-to-first-frame < 3 seconds after video load
- ZIP generation completes without browser crash up to 200MB input
- User can adjust FPS, format, quality, and time range before extraction
- Mobile-responsive layout (at least tablet)

---

## 5. Core User Journey

```
1. User lands on FrameForge
2. Drag & drop (or click) to upload video
3. Video previews in-browser
4. User adjusts:
   - Start / End time (via scrubber)
   - FPS (slider: 1–120)
   - Output format (PNG / JPEG)
   - Image size (original / 1080p / 720p / 480p)
   - JPEG quality (if JPEG selected)
5. Click "EXTRACT FRAMES"
6. Live extraction progress with frame previews
7. Download ZIP of numbered frames
```

---

## 6. Out of Scope (v1)

- Cloud storage / login
- Batch video processing
- Video editing (trim only via time range)
- Audio extraction
- Server-side fallback
- Mobile native app

---

## 7. Constraints

- Must work in Chrome 94+ and Firefox 90+ (WebCodecs / Canvas API)
- No external API calls; fully offline-capable after page load
- ZIP generated using JSZip in-browser
- File size guidance: warn users if video > 500MB
- Frame count warning if estimated frames > 5000

---

## 8. Versioning

| Version | Feature Set |
|---|---|
| v1.0 | Core extraction, ZIP download, FPS up to 120, PNG/JPEG |
| v1.1 | Frame preview grid, segment scrubber |
| v1.2 | Batch extraction queue, multiple videos |
| v2.0 | WebCodecs hardware acceleration, WebWorker threading |
