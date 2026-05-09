# UI_UX.md — BistroSeq User Interface & Experience Spec

## UX Principles

1. **Elegant Simplicity** — The experience is clean and focused, like a well-designed bistro menu.
2. **Artisanal Feedback** — Every action is accompanied by warm, subtle animations and clear status chips.
3. **Trust & Privacy** — Explicitly communicate that all processing is "House Local" (client-side).
4. **Luxurious Spacing** — Generous 12px base spacing to let typography and content breathe.

---

## Screen States

### State 0: Welcome (Hero)
```
┌─────────────────────────────────────────────────────┐
│ NAVBAR: BISTROSEQ            GITHUB  PROCESS        │
├─────────────────────────────────────────────────────┤
│                                                     │
│           BISTROSEQ                                 │
│      ARTISANAL VIDEO → FRAMES                       │
│   Transform videos into elegant sequences           │
│   Up to 120 FPS. 100% Private.                      │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │                                             │   │
│  │         ⬆                                  │   │
│  │    PLACE VIDEO HERE                        │   │
│  │                                             │   │
│  │ [Select from Computer] or paste a URL below │   │
│  │                                             │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [https://... paste direct URL ]  [FETCH]          │
│                                                     │
│  Supports: MP4 · WebM · MOV · AVI · MKV · OGG     │
│                                                     │
│  ──────────────────────────────────────────────    │
│  120 FPS  |  PRIVATE  |  PNG + JPEG  |  FREE       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Interactions:**
- Drop zone border slowly pulses with cyan glow (CSS animation, 3s loop)
- On hover: border brightens, icon scales up 1.1×
- On drag-over: full border glow, background tint `rgba(6,182,212,0.03)`

---

### State 1: Video Loaded
```
┌────────────────────────────────────────────────────┐
│ NAVBAR                                             │
├────────────────────────────────────────────────────┤
│                                                    │
│  ┌─────────────────────┐  ┌─────────────────────┐ │
│  │                     │  │  📄 myvideo.mp4     │ │
│  │  [VIDEO PREVIEW]    │  │  768×898 · 1.19MB  │ │
│  │                     │  │  Duration: 9.83s   │ │
│  │  ───────────────    │  │  Type: mp4 (H.264) │ │
│  │  ◀ 0:00  ▶  0:09   │  └─────────────────────┘ │
│  └─────────────────────┘                          │
│                                                    │
│  SETTINGS ─────────────────────────────────────── │
│                                                    │
│  ┌─── TIME RANGE ──────────────────────────────┐  │
│  │  [0.00s] ══════════════════════ [9.83s]     │  │
│  │  Start: [0.00]  End: [9.83]   Frames: ~295  │  │
│  └─────────────────────────────────────────────┘  │
│                                                    │
│  ┌─── FRAME RATE ──────────────────────────────┐  │
│  │  [1][6][12][24][30][60][120]  Custom: [30]  │  │
│  │  ──────────────█────────────                │  │
│  │  30 FPS  →  295 frames total                │  │
│  └─────────────────────────────────────────────┘  │
│                                                    │
│  ┌─── FORMAT ───────┐  ┌─── SIZE ──────────────┐  │
│  │  (•) PNG  ( ) JPEG│  │  [Original (768px) ▼] │  │
│  └──────────────────┘  └───────────────────────┘  │
│                                                    │
│  ▶ More Options (filename prefix, JPEG quality)    │
│                                                    │
│  ┌─────────────────────────────────────────────┐  │
│  │        ⚡  EXTRACT 295 FRAMES               │  │
│  └─────────────────────────────────────────────┘  │
│                                                    │
│  [🔄 Load Different Video]                        │
└────────────────────────────────────────────────────┘
```

**Key UX Behaviors:**
- Settings panel slides down with spring animation after video loads
- Frame count updates in real-time as user adjusts FPS or time range
- "Extract N frames" button label dynamically shows the count
- Warning badge appears if N > 3000: "⚠ Large job — may take a while"

---

### State 2: Extracting
```
┌────────────────────────────────────────────────────┐
│ NAVBAR                                             │
├────────────────────────────────────────────────────┤
│                                                    │
│  EXTRACTING FRAMES ────────────────────────────── │
│                                                    │
│  Frame 87 of 295                                   │
│  ████████████████████░░░░░░░░░░░░  29%            │
│                         ~18 seconds remaining      │
│                                                    │
│  [⬛ CANCEL]                                       │
│                                                    │
│  PREVIEW ──────────────────────────────────────── │
│                                                    │
│  [img][img][img][img][img][img][img][img]          │
│  [img][img][img][img][img][img][img][img]          │
│  (latest extracted frames, scrollable)             │
│                                                    │
└────────────────────────────────────────────────────┘
```

**Key UX Behaviors:**
- Progress bar fills with smooth spring animation (not lerp)
- ETA recalculates every 10 frames
- Frame thumbnails pop in from opacity 0 + scale 0.9
- Cancel button: confirmation toast "Are you sure? Partial frames will be lost."
- Settings panel is hidden/disabled during extraction

---

### State 3: Complete — Ready to Download
```
┌────────────────────────────────────────────────────┐
│ NAVBAR                                             │
├────────────────────────────────────────────────────┤
│                                                    │
│  ✅ EXTRACTION COMPLETE ───────────────────────── │
│  295 frames extracted in 11.2 seconds              │
│                                                    │
│  ┌─────────────────────────────────────────────┐  │
│  │                                             │  │
│  │    📦  DOWNLOAD ZIP                         │  │
│  │    frameforge_1717023456.zip                │  │
│  │    Estimated size: ~38MB  (295 PNG frames)  │  │
│  │                                             │  │
│  │        [⬇ DOWNLOAD ZIP]                    │  │
│  │                                             │  │
│  └─────────────────────────────────────────────┘  │
│                                                    │
│  FRAME GALLERY ──────────────────────────────────  │
│  [img][img][img][img][img][img][img][img][img]     │
│  [img][img][img][img][img][img][img][img][img]     │
│  (click any frame to view full size)               │
│                                                    │
│  [🔄 Extract Another Video]                       │
└────────────────────────────────────────────────────┘
```

**Key UX Behaviors:**
- Completion state: progress bar completes → ✅ icon with subtle particle burst animation
- Download card pulses once to draw attention
- Download button: triggers ZIP build then download (progress shown if ZIP is large)
- "Extract Another Video" resets all state

---

## Component Interaction Specs

### FPS Slider
- Range: 1–120
- Snap points: 1, 6, 12, 24, 30, 60, 120
- Keyboard: arrow keys step by 1, Shift+arrow steps by 5
- Visual: track fills in cyan left of thumb
- Thumb: glowing cyan circle, 18px diameter

### Time Range Slider
- Two-handle range slider
- Handles labeled "IN" and "OUT"  
- Video thumbnail preview on hover over track
- Keyboard: Tab to focus handle, arrows to adjust

### Format Toggle (PNG / JPEG)
- Pill-style toggle switch, not a dropdown
- PNG selected: left, active state
- JPEG selected: right, active state + Quality slider appears below with fade-in

### Resolution Dropdown
- Custom styled select (not native)
- Options show pixel dimensions and label
- Adds note if selected size > source size: "⚠ Upscaling from 768px"

### More Options Collapse
- Chevron icon, rotates on open
- Smooth height animation (Framer Motion `AnimatePresence`)
- Contains: Filename prefix input, JPEG quality, ZIP compression toggle

---

## Microinteractions

| Trigger | Response |
|---|---|
| Video dropped | Drop zone shrinks, video player fades in |
| FPS preset clicked | Button gets active glow, slider thumb snaps with spring |
| Frame count > 3000 | Warning badge slides in under frame count |
| Extract button hover | Text gets letter-spacing increase + glow brightens |
| Extract button click | Button morphs into loading bar |
| Frame extracted | Thumbnail pops in with scale + opacity animation |
| Extraction complete | Progress fills to 100% → checkmark morphs in |
| Download clicked | Button briefly shows "Preparing ZIP..." |
| Reset clicked | Fade out → fade in to initial state |

---

## Empty / Error States

### No video loaded (accidental settings tab access)
- Settings panel stays hidden; only drop zone shown

### Unsupported format
```
❌ Format not supported
This browser can't decode [filename.avi]
Try converting to MP4 first.
[Dismiss]
```

### Too many frames warning
```
⚠ Large Job Detected
You're about to extract 4,200 frames at 120 FPS.
This may use significant memory and take 3+ minutes.
[Continue Anyway]  [Reduce FPS]
```

### Out of memory
```
⚠ Memory Limit Reached
Extraction stopped at frame 1,850.
Your browser ran out of memory.
Try: reduce FPS, lower resolution, or shorter segment.
[Download Partial ZIP]  [Try Again with Lower Settings]
```

---

## Accessibility

- All interactive elements keyboard-navigable (Tab order logical)
- Focus rings: 2px cyan outline with 2px offset
- ARIA labels on icon-only buttons
- Progress bar: `role="progressbar"` with `aria-valuenow`
- Drag & drop: fallback `<input type="file">` always present
- Color contrast: all text ≥ 4.5:1 against backgrounds
- Reduced motion: `@media (prefers-reduced-motion)` disables animations

---

## How It Works Section

Collapsible section at bottom of page:

```
HOW IT WORKS ─────────────────────────────────────────

FRAMEFORGE runs entirely in your browser.
Your video never leaves your device.

01  UPLOAD        Drop your video. Decoded locally via HTML5.
02  CONFIGURE     Set FPS, time range, format, and size.
03  EXTRACT       Canvas API captures each frame at exact timestamps.
04  DOWNLOAD      JSZip bundles all frames into a ZIP file.

💡 PRO TIP FOR 3D WEBSITES
For scroll-driven canvas animations (Apple-style), 
24 FPS gives you smooth playback. Use 60+ FPS only for 
ultra-slow-motion sections. Higher FPS = more frames = larger ZIP.

──────────────────────────────────────────────────────
```

---

## Footer

```
FRAMEFORGE                              Made for 3D web creators
Built with WebCodecs + JSZip            View Source on GitHub
                                        
© 2024 · Open Source · MIT License
```
