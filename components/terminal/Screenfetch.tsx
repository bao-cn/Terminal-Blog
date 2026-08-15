import { useEffect, useState } from "react";

type RenderEngine = "Blink" | "Gecko" | "WebKit" | "Other";

type ScreenfetchInfo = {
  ascii: string;
  browser: string;
  renderEngine: RenderEngine;
  userAgent: string;
  viewportSize: string;
  screenResolution: string;
  cpuLogicalCores: string;
  browserHeapMemory: string;
  gpuRenderer: string;
  colorScheme: string;
  navigatorLanguage: string;
  touchSupport: string;
  onlineStatus: string;
  timezone: string;
};

type ScreenfetchProps = {
  colorScheme: string;
};

type PerformanceMemory = {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
};

const UNKNOWN = "unavailable";

const ASCII_PATHS: Partial<Record<RenderEngine, string>> = {
  Blink: "/blink.txt",
  Gecko: "/gecko.txt",
  WebKit: "/webkit.txt",
};

const OTHER_ASCII = [
  "       ___________",
  "      /           \\",
  "     /   /-----\\   \\",
  "    |   |  ???  |   |",
  "    |   |_______|   |",
  "     \\           /",
  "      '-----------'",
].join("\n");

const formatMiB = (bytes: number) => Math.round(bytes / 1024 / 1024) + " MiB";

function detectRenderEngine(userAgent: string): RenderEngine {
  const ua = userAgent.toLowerCase();
  const appleMobile = /iphone|ipad|ipod/.test(ua);

  if (/firefox|fxios/.test(ua) || (ua.includes("gecko/") && !ua.includes("like gecko"))) return "Gecko";
  if (!appleMobile && /chrome|chromium|crios|edg|opr|opera|brave/.test(ua)) return "Blink";
  if (ua.includes("applewebkit/") || ua.includes("webkit/")) return "WebKit";
  return "Other";
}

function detectBrowser(userAgent: string): string {
  const browserPatterns: Array<[string, RegExp]> = [
    ["Samsung Internet", /SamsungBrowser\/([\d.]+)/i],
    ["Edge", /Edg(?:e|A|iOS)?\/([\d.]+)/i],
    ["Opera", /(?:OPR|Opera)\/([\d.]+)/i],
    ["Chrome", /(?:Chrome|CriOS)\/([\d.]+)/i],
    ["Firefox", /(?:Firefox|FxiOS)\/([\d.]+)/i],
    ["Safari", /Version\/([\d.]+).*Safari\//i],
    ["Internet Explorer", /(?:MSIE\s|rv:)([\d.]+)/i],
  ];

  for (const [name, pattern] of browserPatterns) {
    const match = userAgent.match(pattern);
    if (match) return name + " " + match[1];
  }

  return UNKNOWN;
}

function readGpuRenderer(): string {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("webgl") as WebGLRenderingContext | null;
  if (!context) return UNKNOWN;

  const debugInfo = context.getExtension("WEBGL_debug_renderer_info");
  const renderer = debugInfo
    ? context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
    : context.getParameter(context.RENDERER);
  canvas.remove();
  return typeof renderer === "string" && renderer ? renderer : UNKNOWN;
}

function readHeapMemory(): string {
  const memory = (performance as Performance & { memory?: PerformanceMemory }).memory;
  if (!memory) return UNKNOWN;

  return (
    formatMiB(memory.usedJSHeapSize) +
    " / " +
    formatMiB(memory.totalJSHeapSize) +
    " (limit " +
    formatMiB(memory.jsHeapSizeLimit) +
    ")"
  );
}

function collectScreenfetchInfo(colorScheme: string): ScreenfetchInfo {
  const userAgent = navigator.userAgent || UNKNOWN;
  const renderEngine = detectRenderEngine(userAgent);
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  return {
    ascii: OTHER_ASCII,
    browser: detectBrowser(userAgent),
    renderEngine,
    userAgent,
    viewportSize: window.innerWidth + " x " + window.innerHeight,
    screenResolution: window.screen.width + " x " + window.screen.height,
    cpuLogicalCores: navigator.hardwareConcurrency ? String(navigator.hardwareConcurrency) : UNKNOWN,
    browserHeapMemory: readHeapMemory(),
    gpuRenderer: readGpuRenderer(),
    colorScheme,
    navigatorLanguage: navigator.language || UNKNOWN,
    touchSupport: maxTouchPoints > 0 ? "yes (" + maxTouchPoints + " points)" : "no",
    onlineStatus: navigator.onLine ? "online" : "offline",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || UNKNOWN,
  };
}

const INFO_LABELS: Array<[keyof Omit<ScreenfetchInfo, "ascii">, string]> = [
  ["browser", "Browser"],
  ["renderEngine", "Render Engine"],
  ["userAgent", "User-Agent"],
  ["viewportSize", "Viewport Size"],
  ["screenResolution", "Screen Resolution"],
  ["cpuLogicalCores", "CPU Logical Cores"],
  ["browserHeapMemory", "Browser Heap Memory"],
  ["gpuRenderer", "GPU Renderer"],
  ["colorScheme", "Color-Scheme"],
  ["navigatorLanguage", "Navigator Language"],
  ["touchSupport", "Touch Support"],
  ["onlineStatus", "Online Status"],
  ["timezone", "Timezone"],
];

function emptyInfo(colorScheme: string): ScreenfetchInfo {
  return {
    ascii: OTHER_ASCII,
    browser: UNKNOWN,
    renderEngine: "Other",
    userAgent: UNKNOWN,
    viewportSize: UNKNOWN,
    screenResolution: UNKNOWN,
    cpuLogicalCores: UNKNOWN,
    browserHeapMemory: UNKNOWN,
    gpuRenderer: UNKNOWN,
    colorScheme,
    navigatorLanguage: UNKNOWN,
    touchSupport: UNKNOWN,
    onlineStatus: UNKNOWN,
    timezone: UNKNOWN,
  };
}

export default function Screenfetch({ colorScheme }: ScreenfetchProps) {
  const [info, setInfo] = useState<ScreenfetchInfo>(() => emptyInfo(colorScheme));

  useEffect(() => {
    const nextInfo = collectScreenfetchInfo(colorScheme);
    const asciiPath = ASCII_PATHS[nextInfo.renderEngine];
    const controller = new AbortController();

    setInfo(nextInfo);
    if (asciiPath) {
      void fetch(asciiPath, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error("ASCII asset unavailable");
          return response.text();
        })
        .then((ascii) => {
          setInfo((current) =>
            current.renderEngine === nextInfo.renderEngine
              ? { ...current, ascii: ascii.replace(/\r\n/g, "\n").trimEnd() }
              : current,
          );
        })
        .catch(() => undefined);
    }

    return () => controller.abort();
  }, [colorScheme]);

  return (
    <div className="screenfetch-output">
      <pre className="screenfetch-ascii" aria-label={info.renderEngine + " ASCII logo"}>
        {info.ascii}
      </pre>
      <dl className="screenfetch-info">
        {INFO_LABELS.map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{info[key]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
