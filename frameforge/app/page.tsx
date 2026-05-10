"use client";

/* eslint-disable @next/next/no-img-element, react-hooks/refs, react-hooks/exhaustive-deps */

import JSZip from "jszip";
import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  CheckCircle2,
  ChevronDown,
  Download,
  FileVideo,
  Image as ImageIcon,
  Link,
  Play,
  RotateCcw,
  Scissors,
  Settings2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";

type OutputFormat = "png" | "jpeg";
type Status = "idle" | "loaded" | "extracting" | "complete" | "error";

type ResolutionPreset = "original" | "1080" | "720" | "480" | "custom";
type ExtractionMode = "fast" | "exact";

type VideoMeta = {
  name: string;
  size: number;
  type: string;
  duration: number;
  width: number;
  height: number;
};

type FrameBlob = {
  blob: Blob;
  index: number;
  filename: string;
  objectUrl: string;
};

const supportedExtensions = [".mp4", ".webm", ".avi", ".mov", ".mkv", ".ogg", ".m4v", ".3gp"];
const fpsPresets = [1, 6, 12, 24, 30, 60, 120];
const resolutionOptions: { value: ResolutionPreset; label: string; width: number | null }[] = [
  { value: "original", label: "Original", width: null },
  { value: "1080", label: "1920 x 1080", width: 1920 },
  { value: "720", label: "1280 x 720", width: 1280 },
  { value: "480", label: "854 x 480", width: 854 },
  { value: "custom", label: "Custom width", width: null },
];

function bytesToSize(bytes: number) {
  if (!bytes) return "Unknown";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function secondsToTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${remaining}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function estimateFrameCount(startTime: number, endTime: number, fps: number) {
  return Math.max(0, Math.ceil(Math.max(endTime - startTime, 0) * fps));
}

function makeFilename(prefix: string, index: number, total: number, format: OutputFormat) {
  const padding = Math.max(4, String(total).length);
  const extension = format === "png" ? "png" : "jpg";
  return `${prefix || "frame_"}${String(index + 1).padStart(padding, "0")}.${extension}`;
}

function canvasToBlob(canvas: HTMLCanvasElement, format: OutputFormat, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not encode this frame."));
      },
      format === "png" ? "image/png" : "image/jpeg",
      quality,
    );
  });
}

function waitForSeek(video: HTMLVideoElement, time: number, timeoutMs = 4000) {
  return new Promise<void>((resolve, reject) => {
    const targetTime = clamp(time, 0, Math.max(video.duration - 0.001, 0));
    if (Math.abs(video.currentTime - targetTime) < 0.002) {
      requestAnimationFrame(() => resolve());
      return;
    }
    let timeoutId = 0;
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("The browser could not seek this video."));
    };

    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
    timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("The browser did not finish seeking this frame."));
    }, timeoutMs);
    video.currentTime = targetTime;
  });
}

function buildTimestamps(startTime: number, endTime: number, fps: number, totalFrames: number) {
  const interval = 1 / fps;
  return Array.from({ length: totalFrames }, (_, index) => startTime + index * interval).filter((time) => time < endTime);
}

function waitForFrame(video: HTMLVideoElement) {
  return new Promise<number>((resolve) => {
    const currentVideo = video;
    let resolved = false;
    const finish = (time: number) => {
      if (resolved) return;
      resolved = true;
      resolve(time);
    };
    window.setTimeout(() => finish(currentVideo.currentTime), 1500);
    if ("requestVideoFrameCallback" in video && typeof video.requestVideoFrameCallback === "function") {
      video.requestVideoFrameCallback((_, metadata) => finish(metadata.mediaTime));
      return;
    }
    requestAnimationFrame(() => finish(currentVideo.currentTime));
  });
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cancelRef = useRef(false);
  const previousFramesRef = useRef<FrameBlob[]>([]);

  const [status, setStatus] = useState<Status>("idle");
  const [dragging, setDragging] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [sourceKind, setSourceKind] = useState<"file" | "url" | null>(null);
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState(30);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [format, setFormat] = useState<OutputFormat>("png");
  const [quality, setQuality] = useState(0.9);
  const [resolution, setResolution] = useState<ResolutionPreset>("original");
  const [customWidth, setCustomWidth] = useState(1280);
  const [filenamePrefix, setFilenamePrefix] = useState("frame_");
  const [moreOpen, setMoreOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(true);
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const [zipCompression, setZipCompression] = useState(false);
  const [extractionMode, setExtractionMode] = useState<ExtractionMode>("fast");
  const [decodeSpeed, setDecodeSpeed] = useState(8);
  const [hasWebCodecs] = useState(() => typeof window !== "undefined" && "VideoDecoder" in window);
  const [frames, setFrames] = useState<FrameBlob[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [zipProgress, setZipProgress] = useState(0);
  const [selectedFrame, setSelectedFrame] = useState<FrameBlob | null>(null);

  const totalFrames = useMemo(() => estimateFrameCount(startTime, endTime, fps), [startTime, endTime, fps]);
  const previewFrames = useMemo(() => frames.slice(-24).reverse(), [frames]);
  const highFrameCount = totalFrames > 3000;
  const veryHighFrameCount = totalFrames > 5000;
  const canExtract = Boolean(videoUrl && meta && totalFrames > 0 && status === "loaded");
  const targetSize = useMemo(() => {
    if (!meta) return { width: 0, height: 0 };
    if (resolution === "custom") {
      const width = clamp(customWidth, 16, meta.width || customWidth);
      return { width, height: meta.width ? Math.round((width / meta.width) * meta.height) : 0 };
    }
    const selected = resolutionOptions.find((option) => option.value === resolution);
    if (!selected?.width || selected.width >= meta.width) return { width: meta.width, height: meta.height };
    return { width: selected.width, height: Math.round((selected.width / meta.width) * meta.height) };
  }, [customWidth, meta, resolution]);
  const estimatedMemory = targetSize.width * targetSize.height * 4 * totalFrames;
  const memoryWarning = estimatedMemory > 500 * 1024 * 1024;

  useEffect(() => {
    const saved = window.localStorage.getItem("vantaseq-settings");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as {
        fps?: number;
        format?: OutputFormat;
        quality?: number;
        resolution?: ResolutionPreset;
        customWidth?: number;
        filenamePrefix?: string;
        extractionMode?: ExtractionMode;
        decodeSpeed?: number;
        previewEnabled?: boolean;
        zipCompression?: boolean;
      };
      window.setTimeout(() => {
        if (parsed.fps) setFps(clamp(parsed.fps, 1, 120));
        if (parsed.format) setFormat(parsed.format);
        if (parsed.quality) setQuality(clamp(parsed.quality, 0.1, 1));
        if (parsed.resolution) setResolution(parsed.resolution);
        if (parsed.customWidth) setCustomWidth(parsed.customWidth);
        if (parsed.filenamePrefix) setFilenamePrefix(parsed.filenamePrefix);
        if (parsed.extractionMode) setExtractionMode(parsed.extractionMode);
        if (parsed.decodeSpeed) setDecodeSpeed(parsed.decodeSpeed);
        if (typeof parsed.previewEnabled === "boolean") setPreviewEnabled(parsed.previewEnabled);
        if (typeof parsed.zipCompression === "boolean") setZipCompression(parsed.zipCompression);
      }, 0);
    } catch {
      window.localStorage.removeItem("vantaseq-settings");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "vantaseq-settings",
      JSON.stringify({
        fps,
        format,
        quality,
        resolution,
        customWidth,
        filenamePrefix,
        extractionMode,
        decodeSpeed,
        previewEnabled,
        zipCompression,
      }),
    );
  }, [customWidth, decodeSpeed, extractionMode, filenamePrefix, format, fps, previewEnabled, quality, resolution, zipCompression]);

  useEffect(() => {
    previousFramesRef.current = frames;
  }, [frames]);

  useEffect(() => {
    return () => {
      if (videoUrl && sourceKind === "file") URL.revokeObjectURL(videoUrl);
      previousFramesRef.current.forEach((frame) => URL.revokeObjectURL(frame.objectUrl));
    };
  }, [videoUrl, sourceKind]);

  useEffect(() => {
    if (status !== "extracting") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [status]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isField = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT";

      if (event.key === "Escape") {
        if (selectedFrame) {
          setSelectedFrame(null);
          return;
        }
        if (status === "extracting") cancelExtraction();
      }

      if (event.code === "Space" && !isField && videoRef.current && status !== "idle") {
        event.preventDefault();
        if (videoRef.current.paused) videoRef.current.play().catch(() => undefined);
        else videoRef.current.pause();
      }
    }

    function onPaste(event: ClipboardEvent) {
      const file = Array.from(event.clipboardData?.files || []).find((item) => item.type.startsWith("video/"));
      if (file) {
        loadFile(file);
        return;
      }
      const text = event.clipboardData?.getData("text")?.trim();
      if (text?.startsWith("http")) {
        setUrlInput(text);
        window.setTimeout(() => loadUrl(text), 0);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("paste", onPaste);
    };
  }, [selectedFrame, status, urlInput]);

  function clearFrames() {
    previousFramesRef.current.forEach((frame) => URL.revokeObjectURL(frame.objectUrl));
    previousFramesRef.current = [];
    setFrames([]);
  }

  function reset() {
    cancelRef.current = true;
    if (videoUrl && sourceKind === "file") URL.revokeObjectURL(videoUrl);
    clearFrames();
    setVideoUrl(null);
    setSourceKind(null);
    setMeta(null);
    setError(null);
    setStatus("idle");
    setStartTime(0);
    setEndTime(0);
    setProgress(0);
    setCurrentFrame(0);
    setZipProgress(0);
    setSelectedFrame(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function isSupportedFile(file: File) {
    const lower = file.name.toLowerCase();
    return file.type.startsWith("video/") || supportedExtensions.some((extension) => lower.endsWith(extension));
  }

  function loadFile(file: File) {
    if (!isSupportedFile(file)) {
      setError(`Unsupported format. Try one of: ${supportedExtensions.join(", ")}`);
      setStatus("error");
      toast.error("Format not supported", {
        description: "Try MP4 or WebM for the most reliable browser decoding.",
      });
      return;
    }
    if (videoUrl && sourceKind === "file") URL.revokeObjectURL(videoUrl);
    clearFrames();
    if (file.size > 500 * 1024 * 1024) {
      toast.warning("Above recommended size", {
        description: "Files over 500MB can stress browser memory.",
      });
    } else if (file.size > 200 * 1024 * 1024) {
      toast.warning("Large file detected", {
        description: "Processing stays local, but this may need time.",
      });
    } else {
      toast.success("Video loaded", { description: "Configure the range, FPS, format, and size." });
    }
    setError(null);
    setMeta({
      name: file.name,
      size: file.size,
      type: file.type || "video",
      duration: 0,
      width: 0,
      height: 0,
    });
    setVideoUrl(URL.createObjectURL(file));
    setSourceKind("file");
    setStatus("loaded");
    setProgress(0);
    setCurrentFrame(0);
  }

  function loadUrl(urlOverride?: string) {
    const trimmed = (urlOverride ?? urlInput).trim();
    if (!trimmed) return;
    try {
      const parsed = new URL(trimmed);
      clearFrames();
      setError(null);
      setMeta({
        name: parsed.pathname.split("/").pop() || "remote-video",
        size: 0,
        type: "Remote URL",
        duration: 0,
        width: 0,
        height: 0,
      });
      setVideoUrl(trimmed);
      setSourceKind("url");
      setStatus("loaded");
      toast.success("Remote video loaded", { description: "Extraction works when the host allows CORS." });
    } catch {
      setError("Paste a valid direct video URL.");
      setStatus("error");
      toast.error("Invalid URL", { description: "Paste a direct video URL." });
    }
  }

  function handleLoadedMetadata() {
    const video = videoRef.current;
    if (!video || !meta) return;
    const duration = video.duration || 0;
    setMeta({
      ...meta,
      duration,
      width: video.videoWidth,
      height: video.videoHeight,
    });
    setStartTime(0);
    setEndTime(Number(duration.toFixed(2)));
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) loadFile(file);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) loadFile(file);
  }

  function syncStartFromVideo() {
    const video = videoRef.current;
    if (!video || !meta) return;
    setStartTime(Number(clamp(video.currentTime, 0, endTime - 0.01).toFixed(2)));
  }

  function syncEndFromVideo() {
    const video = videoRef.current;
    if (!video || !meta) return;
    setEndTime(Number(clamp(video.currentTime, startTime + 0.01, meta.duration).toFixed(2)));
  }

  function getTargetSize() {
    return targetSize;
  }

  async function extractFrames() {
    const video = videoRef.current;
    if (!video || !meta || !canExtract) return;
    if (veryHighFrameCount) {
      toast.warning("Large job detected", {
        description: `${totalFrames.toLocaleString()} frames may take a while and use significant memory.`,
      });
    }
    if (memoryWarning) {
      toast.warning("High memory estimate", {
        description: "Reduce resolution or shorten the range if the browser struggles.",
      });
    }

    cancelRef.current = false;
    clearFrames();
    setStatus("extracting");
    setProgress(0);
    setCurrentFrame(0);
    setZipProgress(0);
    const start = Date.now();
    setStartedAt(start);
    setNow(start);
    setError(null);

    const wasPaused = video.paused;
    const originalTime = video.currentTime;
    const originalRate = video.playbackRate;
    const originalMuted = video.muted;
    video.pause();

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: false });
    if (!context) {
      setError("Canvas is unavailable in this browser.");
      setStatus("error");
      return;
    }

    const { width, height } = getTargetSize();
    canvas.width = width;
    canvas.height = height;

    const timestamps = buildTimestamps(startTime, endTime, fps, totalFrames);
    const actualTotal = timestamps.length;
    const addFrameFromCanvas = async (index: number) => {
      const blob = await canvasToBlob(canvas, format, quality);
      const objectUrl = URL.createObjectURL(blob);
      const frame: FrameBlob = {
        blob,
        index,
        filename: makeFilename(filenamePrefix, index, actualTotal, format),
        objectUrl,
      };
      setFrames((current) => [...current, frame]);
      setCurrentFrame(index + 1);
      setProgress(Math.min(99, Math.floor(((index + 1) / actualTotal) * 100)));
    };

    try {
      if (extractionMode === "fast") {
        toast.message("Fast decode started", {
          description: "This avoids per-frame seeking and keeps PNG lossless.",
        });
        await waitForSeek(video, startTime);
        video.muted = true;
        video.playbackRate = decodeSpeed;
        let nextIndex = 0;
        let lastCapturedTime = startTime;
        let lastMediaTime = -1;
        let stagnantFrames = 0;
        await video.play();

        while (nextIndex < timestamps.length) {
          if (cancelRef.current) throw new Error("Extraction cancelled.");
          const mediaTime = await waitForFrame(video);
          if (Math.abs(mediaTime - lastMediaTime) < 0.002) stagnantFrames += 1;
          else stagnantFrames = 0;
          lastMediaTime = mediaTime;
          if (video.ended || stagnantFrames > 3) break;
          if (mediaTime < startTime) continue;
          if (mediaTime > endTime + 0.05) break;
          video.pause();

          const captureThrough = Math.min(mediaTime + 1 / fps / 2, endTime);
          while (nextIndex < timestamps.length && timestamps[nextIndex] <= captureThrough) {
            if (cancelRef.current) throw new Error("Extraction cancelled.");
            context.drawImage(video, 0, 0, width, height);
            await addFrameFromCanvas(nextIndex);
            lastCapturedTime = timestamps[nextIndex];
            nextIndex += 1;
          }

          if (nextIndex < timestamps.length) {
            video.playbackRate = decodeSpeed;
            await video.play().catch(() => undefined);
          }
        }

        while (nextIndex < timestamps.length && lastCapturedTime < endTime) {
          if (cancelRef.current) throw new Error("Extraction cancelled.");
          try {
            await waitForSeek(video, timestamps[nextIndex], 1500);
          } catch (seekError) {
            const nearTail = timestamps[nextIndex] >= video.duration - 0.2 || video.ended || video.currentTime >= video.duration - 0.2;
            if (!nearTail) throw seekError;
            toast.message("Finishing final frames", {
              description: "The browser stopped firing seek events at the video tail, so the last visible frame is used.",
            });
          }
          context.drawImage(video, 0, 0, width, height);
          await addFrameFromCanvas(nextIndex);
          nextIndex += 1;
        }
      } else {
        for (let index = 0; index < timestamps.length; index += 1) {
          if (cancelRef.current) throw new Error("Extraction cancelled.");
          try {
            await waitForSeek(video, timestamps[index], 2500);
          } catch (seekError) {
            const nearTail = timestamps[index] >= video.duration - 0.2 || video.ended || video.currentTime >= video.duration - 0.2;
            if (!nearTail) throw seekError;
            toast.message("Finishing final frames", {
              description: "The browser stopped firing seek events at the video tail, so the last visible frame is used.",
            });
          }
          context.drawImage(video, 0, 0, width, height);
          await addFrameFromCanvas(index);
          await new Promise((resolve) => window.setTimeout(resolve, 0));
        }
      }
      setStatus("complete");
      setProgress(100);
      toast.success("Extraction complete", { description: `${actualTotal.toLocaleString()} frames are ready.` });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Extraction failed.";
      setError(message);
      setStatus(message === "Extraction cancelled." ? "loaded" : "error");
      if (message === "Extraction cancelled.") toast.message("Extraction cancelled");
      else toast.error("Extraction failed", { description: message });
    } finally {
      video.pause();
      video.playbackRate = originalRate;
      video.muted = originalMuted;
      await waitForSeek(video, originalTime).catch(() => undefined);
      if (!wasPaused) video.play().catch(() => undefined);
    }
  }

  function cancelExtraction() {
    if (window.confirm("Cancel extraction? Partial frames will stay available until you reset.")) {
      cancelRef.current = true;
    }
  }

  async function downloadZip() {
    if (!frames.length) return;
    setZipProgress(1);
    toast.message("Preparing ZIP", { description: "The download will begin automatically." });
    const zip = new JSZip();
    frames.forEach((frame) => zip.file(frame.filename, frame.blob));
    const blob = await zip.generateAsync(
      {
        type: "blob",
        compression: zipCompression || format === "jpeg" ? "DEFLATE" : "STORE",
        compressionOptions: { level: 4 },
      },
      (metadata) => setZipProgress(Math.round(metadata.percent)),
    );
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = `vantaseq_${Date.now()}.zip`;
    anchor.click();
    URL.revokeObjectURL(downloadUrl);
    toast.success("Download started");
    window.setTimeout(() => setZipProgress(0), 1000);
  }

  const elapsedSeconds = startedAt && now ? (now - startedAt) / 1000 : 0;
  const eta =
    status === "extracting" && currentFrame > 0
      ? Math.max(0, (elapsedSeconds / currentFrame) * Math.max(totalFrames - currentFrame, 0))
      : 0;

  return (
    <main className="app-shell flex min-h-screen flex-col">
      <Navbar />

      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 pb-12 pt-28 sm:px-8 lg:px-10">
        {status === "idle" || !videoUrl ? (
          <Hero />
        ) : (
          <div className="mb-8 grid gap-6 lg:grid-cols-[1.45fr_0.8fr]">
            <VideoPreview videoRef={videoRef} videoUrl={videoUrl} meta={meta} onLoadedMetadata={handleLoadedMetadata} />
            <MetaPanel
              meta={meta}
              sourceKind={sourceKind}
              hasWebCodecs={hasWebCodecs}
              extractionMode={extractionMode}
              onReset={reset}
            />
          </div>
        )}

        {(status === "idle" || status === "error") && (
          <UploadPanel
            dragging={dragging}
            error={error}
            fileInputRef={fileInputRef}
            urlInput={urlInput}
            onDrop={handleDrop}
            onDragEnter={() => setDragging(true)}
            onDragLeave={() => setDragging(false)}
            onDragOver={(event) => event.preventDefault()}
            onFileChange={handleFileChange}
            onPickFile={() => fileInputRef.current?.click()}
            onUrlInput={setUrlInput}
            onLoadUrl={loadUrl}
          />
        )}

        {meta && videoUrl && (status === "loaded" || status === "extracting" || status === "complete") && (
          <>
            {status === "loaded" && (
              <SettingsPanel
                meta={meta}
                fps={fps}
                startTime={startTime}
                endTime={endTime}
                totalFrames={totalFrames}
                highFrameCount={highFrameCount}
                format={format}
                quality={quality}
                resolution={resolution}
                customWidth={customWidth}
                filenamePrefix={filenamePrefix}
                moreOpen={moreOpen}
                previewEnabled={previewEnabled}
                zipCompression={zipCompression}
                extractionMode={extractionMode}
                decodeSpeed={decodeSpeed}
                targetSize={targetSize}
                memoryWarning={memoryWarning}
                veryHighFrameCount={veryHighFrameCount}
                onFps={setFps}
                onStartTime={(value) => setStartTime(Number(clamp(value, 0, endTime - 0.01).toFixed(2)))}
                onEndTime={(value) => setEndTime(Number(clamp(value, startTime + 0.01, meta.duration).toFixed(2)))}
                onFormat={setFormat}
                onQuality={setQuality}
                onResolution={setResolution}
                onCustomWidth={setCustomWidth}
                onFilenamePrefix={setFilenamePrefix}
                onMoreOpen={setMoreOpen}
                onPreviewEnabled={setPreviewEnabled}
                onZipCompression={setZipCompression}
                onExtractionMode={setExtractionMode}
                onDecodeSpeed={setDecodeSpeed}
                onSyncStart={syncStartFromVideo}
                onSyncEnd={syncEndFromVideo}
              />
            )}

            {status === "loaded" && (
              <div className="mt-8">
                <button
                  className="btn-primary min-h-16 w-full text-base sm:text-lg"
                  disabled={!canExtract}
                  onClick={extractFrames}
                >
                  <Zap size={22} />
                  Extract {totalFrames.toLocaleString()} Frames
                </button>
              </div>
            )}

            {status === "extracting" && (
              <ExtractionProgress
                currentFrame={currentFrame}
                totalFrames={totalFrames}
                progress={progress}
                eta={eta}
                onCancel={cancelExtraction}
              />
            )}

            {status === "complete" && (
              <DownloadCard
                frameCount={frames.length}
                format={format}
                size={frames.reduce((sum, frame) => sum + frame.blob.size, 0)}
                zipProgress={zipProgress}
                onDownload={downloadZip}
                onReset={reset}
              />
            )}

            {frames.length > 0 && previewEnabled && <FrameGrid frames={previewFrames} onSelect={setSelectedFrame} />}
            {frames.length > 0 && !previewEnabled && (
              <p className="bistro-card mt-5 p-4 text-sm text-secondary">
                Preview is off to reduce rendering work. {frames.length.toLocaleString()} frames are still being kept for ZIP export.
              </p>
            )}
          </>
        )}

        <HowItWorks open={howOpen} onOpen={setHowOpen} />
      </section>

      <Footer />

      {selectedFrame && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#1c1917]/90 p-5 backdrop-blur-sm">
          <img
            className="max-h-[88vh] max-w-[92vw] border-4 border-white object-contain shadow-xl"
            src={selectedFrame.objectUrl}
            alt={selectedFrame.filename}
          />
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a className="btn-primary px-6 py-3" href={selectedFrame.objectUrl} download={selectedFrame.filename}>
              Save Frame
            </a>
            <button className="btn-secondary bg-white px-6 py-3" onClick={() => setSelectedFrame(null)}>
              Close
            </button>
          </div>
        </div>
      )}
      <Toaster theme="light" richColors position="bottom-right" />
    </main>
  );
}

function Navbar() {
  return (
    <header className="navbar fixed left-0 right-0 top-0 z-30 shadow-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8 lg:px-10">
        <a className="font-display text-xl font-bold tracking-tight text-primary" href="#">
          Bistro<span className="text-secondary">Seq</span>
        </a>
        <nav className="flex items-center gap-4 text-sm font-medium text-text-secondary">
          <a className="hidden transition hover:text-primary sm:inline" href="#how-it-works">
            Process
          </a>
          <a className="btn-ghost flex items-center gap-2 px-3 py-2" href="https://github/NilambarSonu.com" target="_blank">
            <Archive size={14} /> GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      className="hero-section flex flex-col items-center justify-center text-center"
      initial={{ opacity: 0, y: 18 }}
      transition={{ duration: 0.55 }}
    >
      <motion.p
        animate={{ opacity: 1 }}
        className="font-mono-ui mb-4 text-xs font-semibold uppercase tracking-widest text-secondary"
        initial={{ opacity: 0 }}
        transition={{ delay: 0.2 }}
      >
        Est. 2026 • Local Extraction • Lossless PNG
      </motion.p>
      <motion.h1
        animate={{ opacity: 1, y: 0 }}
        className="font-display text-5xl font-black text-primary sm:text-6xl lg:text-7xl"
        initial={{ opacity: 0, y: 24 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 100 }}
      >
        Bistro<span className="text-secondary">Seq</span>
      </motion.h1>
      <motion.h2
        animate={{ opacity: 1 }}
        className="font-display mt-6 text-xl text-text-secondary sm:text-2xl"
        initial={{ opacity: 0 }}
        transition={{ delay: 0.4 }}
      >
        Artisanal Video to Frame Sequences
      </motion.h2>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-text-secondary">
        Transform your videos into elegant image sequences. Crafted locally in your browser with zero server uploads.
      </p>
      <div className="mt-10 grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
        {["120 FPS Max", "Private", "PNG + JPEG", "Free"].map((item) => (
          <div className="bistro-card-elevated border-t-2 border-secondary py-4 text-sm font-bold uppercase tracking-wide text-primary" key={item}>
            {item}
          </div>
        ))}
      </div>
    </motion.section>
  );
}

type UploadPanelProps = {
  dragging: boolean;
  error: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  urlInput: string;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPickFile: () => void;
  onUrlInput: (value: string) => void;
  onLoadUrl: () => void;
};

function UploadPanel(props: UploadPanelProps) {
  return (
    <section className="mx-auto w-full max-w-4xl">
      <div
        className={`bistro-card border-2 border-dashed ${props.dragging ? "border-primary bg-primary/5" : "border-border"} flex min-h-72 flex-col items-center justify-center px-5 py-12 text-center transition-all`}
        onDrop={props.onDrop}
        onDragEnter={props.onDragEnter}
        onDragLeave={props.onDragLeave}
        onDragOver={props.onDragOver}
      >
        <input
          ref={props.fileInputRef}
          className="sr-only"
          type="file"
          accept="video/*,.avi,.mkv,.mov,.m4v,.3gp"
          onChange={props.onFileChange}
        />
        <Upload className="mb-6 text-secondary" size={48} />
        <h3 className="text-2xl font-bold text-primary">Place Video Here</h3>
        <p className="mt-3 max-w-md text-text-secondary">
          MP4, WebM, and other common formats are accepted for local browser processing.
        </p>
        <button className="btn-primary mt-8 px-8 py-3" onClick={props.onPickFile}>
          Select from Computer
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <Link size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" />
          <input
            className="bistro-input w-full pl-11"
            value={props.urlInput}
            onChange={(event) => props.onUrlInput(event.target.value)}
            onPaste={(event) => {
              const pasted = event.clipboardData.getData("text");
              if (pasted.startsWith("http")) window.setTimeout(props.onLoadUrl, 0);
            }}
            placeholder="Paste a direct video URL..."
          />
        </div>
        <button className="btn-secondary px-8 py-2 font-bold uppercase tracking-wider" onClick={props.onLoadUrl}>
          Fetch
        </button>
      </div>

      {props.error && (
        <div className="mt-4 border border-error bg-error/5 px-4 py-3 text-sm text-error">{props.error}</div>
      )}
    </section>
  );
}

function VideoPreview({
  videoRef,
  videoUrl,
  meta,
  onLoadedMetadata,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoUrl: string;
  meta: VideoMeta | null;
  onLoadedMetadata: () => void;
}) {
  return (
    <section className="bistro-card-elevated overflow-hidden p-0!">
      <video
        ref={videoRef}
        className="aspect-video w-full bg-[#1c1917] object-contain"
        src={videoUrl}
        controls
        crossOrigin="anonymous"
        onLoadedMetadata={onLoadedMetadata}
      />
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        <span className="flex min-w-0 items-center gap-3">
          <Play size={18} className="shrink-0 text-secondary" />
          <span className="truncate font-bold text-primary">{meta?.name || "Video Selection"}</span>
        </span>
        <span className="font-mono-ui shrink-0 font-bold text-primary">{secondsToTime(meta?.duration || 0)}</span>
      </div>
    </section>
  );
}

function MetaPanel({
  meta,
  sourceKind,
  hasWebCodecs,
  extractionMode,
  onReset,
}: {
  meta: VideoMeta | null;
  sourceKind: "file" | "url" | null;
  hasWebCodecs: boolean;
  extractionMode: ExtractionMode;
  onReset: () => void;
}) {
  return (
    <aside className="bistro-card flex flex-col justify-between">
      <div>
        <div className="mb-6 flex items-center gap-4">
          <div className="bg-tertiary flex h-12 w-12 items-center justify-center rounded-full">
            <FileVideo className="text-primary" size={24} />
          </div>
          <div className="min-w-0">
            <p className="truncate font-bold text-primary">{meta?.name}</p>
            <p className="text-xs font-bold uppercase tracking-widest text-secondary">{sourceKind === "url" ? "Remote Special" : "House Local"}</p>
          </div>
        </div>
        <div className="dashed-divider" />
        <dl className="grid gap-3 text-sm">
          <Info label="Resolution" value={meta?.width ? `${meta.width} x ${meta.height}` : "Analyzing..."} />
          <Info label="Duration" value={secondsToTime(meta?.duration || 0)} />
          <Info label="Size" value={bytesToSize(meta?.size || 0)} />
          <Info label="Format" value={meta?.type?.split('/').pop()?.toUpperCase() || "Video"} />
          <Info label="Engine" value={extractionMode === "fast" ? "Fast" : "Exact"} />
          <Info label="Hardware" value={hasWebCodecs ? "Accelerated" : "Standard"} />
        </dl>
      </div>
      <button className="btn-secondary mt-8 w-full" onClick={onReset}>
        <RotateCcw size={16} /> Load New Video
      </button>
    </aside>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="font-mono-ui font-bold text-primary">{value}</dd>
    </div>
  );
}

type SettingsPanelProps = {
  meta: VideoMeta;
  fps: number;
  startTime: number;
  endTime: number;
  totalFrames: number;
  highFrameCount: boolean;
  format: OutputFormat;
  quality: number;
  resolution: ResolutionPreset;
  customWidth: number;
  filenamePrefix: string;
  moreOpen: boolean;
  previewEnabled: boolean;
  zipCompression: boolean;
  extractionMode: ExtractionMode;
  decodeSpeed: number;
  targetSize: { width: number; height: number };
  memoryWarning: boolean;
  veryHighFrameCount: boolean;
  onFps: (fps: number) => void;
  onStartTime: (time: number) => void;
  onEndTime: (time: number) => void;
  onFormat: (format: OutputFormat) => void;
  onQuality: (quality: number) => void;
  onResolution: (resolution: ResolutionPreset) => void;
  onCustomWidth: (width: number) => void;
  onFilenamePrefix: (prefix: string) => void;
  onMoreOpen: (open: boolean) => void;
  onPreviewEnabled: (enabled: boolean) => void;
  onZipCompression: (enabled: boolean) => void;
  onExtractionMode: (mode: ExtractionMode) => void;
  onDecodeSpeed: (speed: number) => void;
  onSyncStart: () => void;
  onSyncEnd: () => void;
};

function SettingsPanel(props: SettingsPanelProps) {
  return (
    <section className="mt-4 grid gap-6">
      <div className="flex items-center gap-3">
        <Settings2 size={22} className="text-primary" />
        <h3 className="text-2xl font-bold text-primary">Preparation</h3>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SettingCard title="Cuts & Trim" icon={<Scissors size={18} />}>
          <div className="grid gap-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="bistro-label">Start Time</label>
                <input
                  className="bistro-input w-full"
                  type="number"
                  min={0}
                  max={props.endTime}
                  step={0.01}
                  value={props.startTime}
                  onChange={(e) => props.onStartTime(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="bistro-label">End Time</label>
                <input
                  className="bistro-input w-full"
                  type="number"
                  min={props.startTime}
                  max={props.meta.duration}
                  step={0.01}
                  value={props.endTime}
                  onChange={(e) => props.onEndTime(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <input
                className="accent-primary h-2 w-full cursor-pointer appearance-none rounded-lg bg-border"
                type="range"
                min={0}
                max={props.meta.duration || 1}
                step={0.01}
                value={props.startTime}
                onChange={(event) => props.onStartTime(Number(event.target.value))}
              />
              <input
                className="accent-primary h-2 w-full cursor-pointer appearance-none rounded-lg bg-border"
                type="range"
                min={0}
                max={props.meta.duration || 1}
                step={0.01}
                value={props.endTime}
                onChange={(event) => props.onEndTime(Number(event.target.value))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button className="btn-secondary text-xs" onClick={props.onSyncStart}>
                Current Time as In
              </button>
              <button className="btn-secondary text-xs" onClick={props.onSyncEnd}>
                Current Time as Out
              </button>
            </div>
          </div>
        </SettingCard>

        <SettingCard title="Frame Rate" icon={<Zap size={18} />}>
          <div className="flex flex-wrap gap-2">
            {fpsPresets.map((preset) => (
              <button
                className={`px-3 py-1.5 text-xs font-bold transition-all border rounded ${
                  props.fps === preset 
                  ? "bg-primary text-white border-primary" 
                  : "bg-white text-primary border-border hover:border-primary"
                }`}
                key={preset}
                onClick={() => props.onFps(preset)}
              >
                {preset}
              </button>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-[1fr_5rem] gap-4">
            <input
              className="accent-primary h-2 w-full cursor-pointer appearance-none rounded-lg bg-border self-center"
              type="range"
              min={1}
              max={120}
              value={props.fps}
              onChange={(event) => props.onFps(Number(event.target.value))}
            />
            <input
              className="bistro-input w-full text-center font-bold"
              type="number"
              min={1}
              max={120}
              value={props.fps}
              onChange={(event) => props.onFps(clamp(Number(event.target.value), 1, 120))}
            />
          </div>
          <div className="dashed-divider my-4" />
          <p className="font-display text-lg font-bold text-primary">
            Yield: {props.totalFrames.toLocaleString()} frames
          </p>
          {props.highFrameCount && (
            <div className="mt-3 chip chip-status-limited">
              <span className="font-bold">Large yield:</span> browser performance may vary.
            </div>
          )}
        </SettingCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SettingCard title="Output Format" icon={<ImageIcon size={18} />}>
          <div className="flex rounded-md border border-border bg-white p-1">
            {(["png", "jpeg"] as OutputFormat[]).map((option) => (
              <button
                key={option}
                className={`flex-1 py-2 text-sm font-bold uppercase tracking-widest transition rounded ${
                  props.format === option ? "bg-primary text-white" : "text-text-secondary hover:bg-tertiary"
                }`}
                onClick={() => props.onFormat(option)}
              >
                {option}
              </button>
            ))}
          </div>
          {props.format === "jpeg" && (
            <div className="mt-6">
              <div className="mb-2 flex justify-between">
                <label className="bistro-label">Quality</label>
                <span className="font-mono-ui font-bold text-primary">{Math.round(props.quality * 100)}%</span>
              </div>
              <input
                className="accent-primary h-2 w-full cursor-pointer appearance-none rounded-lg bg-border"
                type="range"
                min={10}
                max={100}
                value={Math.round(props.quality * 100)}
                onChange={(event) => props.onQuality(Number(event.target.value) / 100)}
              />
            </div>
          )}
          <p className="mt-4 text-sm italic text-text-secondary">
            {props.format === "png" ? "PNG provides lossless quality, ideal for professional post-processing." : "JPEG reduces file size significantly while maintaining good detail."}
          </p>
        </SettingCard>

        <SettingCard title="Size & Resolution" icon={<Archive size={18} />}>
          <select
            className="bistro-input bistro-select w-full font-bold"
            value={props.resolution}
            onChange={(event) => props.onResolution(event.target.value as ResolutionPreset)}
          >
            {resolutionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {props.resolution === "custom" && (
            <div className="mt-4">
              <label className="bistro-label">Desired Width (px)</label>
              <input
                className="bistro-input w-full"
                min={16}
                max={props.meta.width}
                type="number"
                value={props.customWidth}
                onChange={(event) => props.onCustomWidth(clamp(Number(event.target.value), 16, props.meta.width))}
              />
            </div>
          )}
          <div className="dashed-divider my-4" />
          <p className="text-sm font-bold text-primary">
            Export Dimensions: {props.targetSize.width || 0} × {props.targetSize.height || 0}
          </p>
          {props.memoryWarning && (
            <div className="mt-3 chip chip-status-soldout">
              <span className="font-bold">Heavy memory load:</span> consider lowering resolution.
            </div>
          )}
        </SettingCard>
      </div>

      <div className="bistro-card-featured bistro-card">
        <div className="flex items-center gap-3 mb-4">
          <Zap size={20} className="text-secondary" />
          <h4 className="font-bold text-primary">Extraction Engine</h4>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <button
            className={`bistro-card text-left transition-all ${props.extractionMode === "fast" ? "border-primary bg-primary/5" : "hover:border-primary"}`}
            onClick={() => props.onExtractionMode("fast")}
          >
            <span className="block font-bold text-primary uppercase text-sm">Fast Decode</span>
            <span className="mt-2 block text-xs leading-relaxed text-text-secondary">
              Optimized for high-FPS. Avoids per-frame seeks by playing through the sequence.
            </span>
          </button>
          <button
            className={`bistro-card text-left transition-all ${props.extractionMode === "exact" ? "border-primary bg-primary/5" : "hover:border-primary"}`}
            onClick={() => props.onExtractionMode("exact")}
          >
            <span className="block font-bold text-primary uppercase text-sm">Exact Seek</span>
            <span className="mt-2 block text-xs leading-relaxed text-text-secondary">
              Traditional per-frame seeking. Best for very short segments or low-FPS tasks.
            </span>
          </button>
        </div>
        {props.extractionMode === "fast" && (
          <div className="mt-6">
            <div className="mb-2 flex justify-between">
              <label className="bistro-label">Decode Speed</label>
              <span className="font-mono-ui font-bold text-primary">{props.decodeSpeed}x</span>
            </div>
            <input
              className="accent-primary h-2 w-full cursor-pointer appearance-none rounded-lg bg-border"
              min={1}
              max={16}
              step={1}
              type="range"
              value={props.decodeSpeed}
              onChange={(event) => props.onDecodeSpeed(Number(event.target.value))}
            />
          </div>
        )}
      </div>

      <div className="bistro-card">
        <button
          className="flex w-full items-center justify-between text-left font-bold text-primary"
          onClick={() => props.onMoreOpen(!props.moreOpen)}
        >
          Additional Options
          <ChevronDown className={`transition ${props.moreOpen ? "rotate-180" : ""}`} size={20} />
        </button>
        <AnimatePresence initial={false}>
          {props.moreOpen && (
            <motion.div
              animate={{ height: "auto", opacity: 1 }}
              className="overflow-hidden"
              exit={{ height: 0, opacity: 0 }}
              initial={{ height: 0, opacity: 0 }}
            >
              <div className="mt-6 grid gap-6">
                <div>
                  <label className="bistro-label">Filename Prefix</label>
                  <input
                    className="bistro-input w-full"
                    value={props.filenamePrefix}
                    onChange={(event) => props.onFilenamePrefix(event.target.value)}
                    placeholder="e.g. frame_"
                  />
                </div>
                <div className="flex flex-col gap-4">
                  <label className="flex items-center justify-between gap-4 cursor-pointer">
                    <span className="text-sm font-medium text-text-secondary">Live Preview Grid</span>
                    <input
                      checked={props.previewEnabled}
                      className="accent-primary h-5 w-5 rounded border-border"
                      type="checkbox"
                      onChange={(event) => props.onPreviewEnabled(event.target.checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-4 cursor-pointer">
                    <span className="text-sm font-medium text-text-secondary">Enable ZIP Compression</span>
                    <input
                      checked={props.zipCompression}
                      className="accent-primary h-5 w-5 rounded border-border"
                      type="checkbox"
                      onChange={(event) => props.onZipCompression(event.target.checked)}
                    />
                  </label>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

function SettingCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bistro-card h-full">
      <div className="mb-4 flex items-center gap-3">
        <span className="text-secondary">{icon}</span>
        <h4 className="font-bold uppercase tracking-wider text-primary">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function ExtractionProgress({
  currentFrame,
  totalFrames,
  progress,
  eta,
  onCancel,
}: {
  currentFrame: number;
  totalFrames: number;
  progress: number;
  eta: number;
  onCancel: () => void;
}) {
  return (
    <section className="bistro-card mt-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h3 className="font-display text-xl font-bold text-primary">In Progress...</h3>
        <p className="font-mono-ui font-bold text-primary">
          {currentFrame.toLocaleString()} / {totalFrames.toLocaleString()} ({progress}%)
        </p>
      </div>
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <span className="text-sm italic text-text-secondary">
          {currentFrame >= totalFrames || progress >= 99 ? "Plating your frames..." : `Estimated time remaining: ~${Math.max(0, Math.ceil(eta))} seconds`}
        </span>
        <button className="btn-secondary px-6 py-2 text-sm" onClick={onCancel}>
          <X size={16} /> Stop Extraction
        </button>
      </div>
    </section>
  );
}

function DownloadCard({
  frameCount,
  format,
  size,
  zipProgress,
  onDownload,
  onReset,
}: {
  frameCount: number;
  format: OutputFormat;
  size: number;
  zipProgress: number;
  onDownload: () => void;
  onReset: () => void;
}) {
  return (
    <section className="bistro-card-featured bistro-card mt-8 flex flex-col items-center py-10 text-center">
      <div className="bg-success/10 mb-6 flex h-16 w-16 items-center justify-center rounded-full">
        <CheckCircle2 className="text-success" size={42} />
      </div>
      <h2 className="font-display text-3xl font-black text-primary">Extraction Complete</h2>
      <p className="mt-4 max-w-md text-text-secondary">
        Chef has prepared <span className="font-bold text-primary">{frameCount.toLocaleString()} {format.toUpperCase()}</span> frames for you. Total estimated size: <span className="font-bold text-primary">{bytesToSize(size)}</span>.
      </p>
      
      {zipProgress > 0 && (
        <div className="mt-8 w-full max-w-lg">
          <div className="progress-track mb-3">
            <div className="progress-fill" style={{ width: `${zipProgress}%` }} />
          </div>
          <p className="font-mono-ui text-sm font-bold text-primary">Bundling ZIP: {zipProgress}%</p>
        </div>
      )}
      
      <div className="mt-10 grid w-full max-w-2xl gap-4 sm:grid-cols-2">
        <button className="btn-primary py-4 text-lg" onClick={onDownload}>
          <Download size={22} /> Download ZIP
        </button>
        <button className="btn-secondary py-4 text-lg" onClick={onReset}>
          <RotateCcw size={22} /> Another Order
        </button>
      </div>
    </section>
  );
}

function FrameGrid({ frames, onSelect }: { frames: FrameBlob[]; onSelect: (frame: FrameBlob) => void }) {
  return (
    <section className="mt-10">
      <div className="flex items-center gap-3 mb-6">
        <ImageIcon size={20} className="text-primary" />
        <h4 className="font-bold uppercase tracking-widest text-primary">Preview Gallery</h4>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {frames.map((frame) => (
          <motion.button
            animate={{ opacity: 1, scale: 1 }}
            className="group relative aspect-video overflow-hidden border border-border bg-[#1c1917] transition-all hover:border-primary hover:z-10 hover:scale-105"
            initial={{ opacity: 0, scale: 0.9 }}
            key={`${frame.filename}-${frame.index}`}
            onClick={() => onSelect(frame)}
            transition={{ duration: 0.16 }}
          >
            <img className="h-full w-full object-cover opacity-90 group-hover:opacity-100" src={frame.objectUrl} alt={frame.filename} />
            <span className="font-mono-ui absolute bottom-1 right-1 bg-white/90 px-1 text-[10px] font-bold text-primary">
              {frame.index + 1}
            </span>
          </motion.button>
        ))}
      </div>
    </section>
  );
}

function HowItWorks({ open, onOpen }: { open: boolean; onOpen: (open: boolean) => void }) {
  return (
    <section id="how-it-works" className="bistro-card mt-12 bg-surface/50">
      <button
        className="flex w-full items-center justify-between text-left"
        onClick={() => onOpen(!open)}
        aria-expanded={open}
        aria-controls="how-it-works-body"
      >
        <h2 className="font-display text-2xl font-bold text-primary">Process & Philosophy</h2>
        <ChevronDown className={`text-secondary transition-transform ${open ? "rotate-180" : ""}`} size={24} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            id="how-it-works-body"
            initial={{ height: 0, opacity: 0 }}
          >
            <div className="mt-8 grid gap-8 md:grid-cols-4">
              {[
                ["01", "Sourcing", "Your video is decoded locally. We never upload your ingredients to our servers."],
                ["02", "Preparation", "Configure your trim, frame rate, and dimensions to perfection."],
                ["03", "Extraction", "Our engine captures every frame with precision, plating them for you in real-time."],
                ["04", "Service", "Everything is bundled into a single ZIP file for you to take home."],
              ].map(([step, title, copy]) => (
                <div className="flex flex-col" key={step}>
                  <p className="font-display text-2xl font-black text-secondary/30">{step}</p>
                  <h3 className="mt-2 font-bold uppercase tracking-wider text-primary">{title}</h3>
                  <div className="dashed-divider my-3" />
                  <p className="text-sm leading-relaxed text-text-secondary">{copy}</p>
                </div>
              ))}
            </div>
            <div className="dashed-divider mt-8" />
            <p className="mt-4 text-sm italic text-text-secondary text-center">
              &quot;Quality is never an accident; it is always the result of high intention, sincere effort, intelligent direction and skillful execution.&quot;
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function Footer() {
  return (
    <footer className="relative z-10 py-10 text-center">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-10">
        <div className="dashed-divider mb-6" />
        <p className="font-display text-lg font-bold text-primary">BistroSeq</p>
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-secondary">
          Premium Frame Extraction • Local Service
        </p>
      </div>
    </footer>
  );
}
