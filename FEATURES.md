# FEATURES.md — BistroSeq Feature Specifications

## F1. Video Sourcing

### F1.1 Drag & Drop Zone
- Full-width cinematic drop zone with animated glow border on hover
- Supports: MP4, WebM, AVI, MOV, MKV, OGG, M4V, 3GP
- Max recommended size: 500MB (with soft warning above 200MB)
- Paste from clipboard support (Ctrl+V)
- Click-to-browse fallback

### F1.2 URL Input
- Paste direct video URL (CORS-permitting)
- Auto-detect and load video from URL on paste

### F1.3 Video Preview
- Inline HTML5 `<video>` player after upload
- Shows: filename, resolution, duration, file size, codec info
- Scrubber to seek and set start/end time

---

## F2. Extraction Settings Panel

### F2.1 Time Range Selector
- Visual range slider over video timeline
- "Start Time" and "End Time" numeric inputs (seconds, 2 decimal places)
- "Use current position" button (syncs from video player)
- Live preview: "This will extract ~N frames"

### F2.2 Frame Rate (FPS) Control
- Slider: 1 FPS to 120 FPS
- Numeric input for exact value
- Preset buttons: 1 | 6 | 12 | 24 | 30 | 60 | 120
- Warning if estimated frame count > 3000: "High frame count may slow browser"

### F2.3 Output Format
- Toggle: PNG / JPEG
- If JPEG: Quality slider 10–100 (default 90)
- Label: "PNG = lossless, larger | JPEG = smaller, lossy"

### F2.4 Resolution / Size
- Dropdown:
  - Original (keep source resolution)
  - 1920×1080 (FHD)
  - 1280×720 (HD)
  - 854×480 (SD)
  - Custom (width input, height auto-calculated)

### F2.5 Filename Prefix
- Text input: default `frame_`
- Output will be: `frame_0001.png`, `frame_0002.png`, etc.
- Padding auto-calculated based on total frame count

---

## F3. Extraction Engine

### F3.1 Client-Side Processing
- Uses HTML5 `<canvas>` to draw video frames
- Seeks video to computed timestamps using `video.currentTime`
- Draws each frame to canvas → exports via `canvas.toBlob()`
- Runs in a loop with `requestAnimationFrame` or `seeked` event

### F3.2 WebCodecs Fast Path (Chrome 94+)
- Detects WebCodecs API availability
- If available: uses `VideoDecoder` for hardware-accelerated frame extraction
- Falls back to canvas-seek method if unavailable

### F3.3 Web Worker Offloading
- Extraction loop runs in a Web Worker to prevent UI freeze
- Main thread receives progress messages and frame blobs
- Worker terminates cleanly on cancel

---

## F4. Progress & Live Preview

### F4.1 Progress Bar
- Full-width neon-glow progress bar
- Shows: "Extracting frame 45 of 298 — 15%"
- ETA calculation: "~12 seconds remaining"
- Cancel button to abort extraction mid-process

### F4.2 Live Frame Preview Grid
- As frames are extracted, thumbnails appear in a scrollable grid
- Grid shows up to last 24 frames (performance cap)
- Clicking a thumbnail shows it full-size in a modal
- Optional: toggle preview on/off to save memory on large jobs

---

## F5. ZIP Export

### F5.1 ZIP Generation
- Uses JSZip library (in-browser, no server)
- Frames added to ZIP as they're extracted (streaming mode)
- ZIP filename: `frameforge_[timestamp].zip`
- Contains flat folder of named frames: `frame_0001.png` etc.

### F5.2 Download Trigger
- Download button activates after extraction completes
- Shows ZIP size estimate before download
- Uses `URL.createObjectURL` + anchor click for download
- Clears blob URL after download to free memory

### F5.3 Single Frame Save
- Right-click on any preview thumbnail → "Save image as"
- OR dedicated "Save frame" button on full-size modal

---

## F6. UX Extras

### F6.1 Reset / New Video
- "Start Over" button that clears state and returns to upload screen
- Confirms if extraction is in progress

### F6.2 Settings Memory
- LocalStorage saves last-used FPS, format, quality settings
- Auto-restored on next visit

### F6.3 Keyboard Shortcuts
- `Space` — play/pause video preview
- `Esc` — cancel extraction / close modal
- `Ctrl+V` — paste video from clipboard

### F6.4 Error Handling
- Unsupported format: friendly toast with supported list
- Browser doesn't support WebCodecs: auto-fallback message
- Out of memory warning if frame count × resolution is extreme
- Network error on URL fetch: retry button

### F6.5 How It Works Section
- Collapsible info section below the tool
- Explains: upload → configure → extract → download flow
- Tips: "For 3D websites, 24 FPS is usually enough. Use 60–120 only for ultra-smooth animations."
