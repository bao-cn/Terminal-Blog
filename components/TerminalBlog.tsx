"use client";

import {
  type DragEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  BookOpenText,
  ChevronRight,
  CircleUserRound,
  Command,
  FolderInput,
  FolderOpen,
  ImageIcon,
  PanelRightClose,
  PanelRightOpen,
  ShieldCheck,
} from "lucide-react";
import PromptComponent from "./terminal/Prompt";
import BootOutputComponent from "./terminal/BootOutput";
import {
  ArticleOutput as ArticleOutputComponent,
  MarkdownSource as MarkdownSourceComponent,
} from "./terminal/ArticleOutput";
import TerminalContextMenu from "./terminal/TerminalContextMenu";
import Screenfetch from "./terminal/Screenfetch";
import NanoEditor from "./terminal/NanoEditor";
import LessViewer from "./terminal/LessViewer";
import { categories as defaultCategories, seedArticles } from "@/lib/blog-data";
import type { Article } from "@/lib/article-store";
import type { AccessFileInfo } from "@/lib/upload-store";
import {
  commandReference,
  findCommand,
  validateCommandArguments,
  type CommandDefinition,
} from "@/lib/command-registry";
import { defaultSiteConfig, type SiteConfig } from "@/lib/site-config";
import { parseFrontmatter, serializeArticleDocument } from "@/lib/article-codec";
import { splitCommand, splitPipeline } from "@/lib/terminal-command-parser";
import { runTextPipeline, runTextStage } from "@/lib/terminal-text-pipeline";

const SETTINGS_KEY = "terminal-blog-settings-v1";
const CONFIG_MD5_KEY = "terminal-blog-config-md5-v1";
const ACCESS_FOLDER_KEY = "::access";

const uiText = {
  zh: {
    friendlyLinks: "友情链接",
    icpRecord: "ICP备案号：待配置",
    policeRecord: "公安备案号：待配置",
    publicArchive: "公共档案",
    connected: "连接已建立。目录索引完成，{count} 篇记录可供访问。",
    browse: "浏览目录",
    read: "阅读文章",
    commands: "打开命令索引",
    systemNominal: "系统正常",
    commandIndex: "命令索引",
    match: "项匹配",
    usage: "用法",
    session: "会话",
    active: "在线",
    administrator: "管理员",
    visitor: "公共访客",
    access: "权限",
    files: "文件",
    latency: "延迟",
    archive: "远程站点",
    rootTools: "管理员工具",
    create: "新建",
    reset: "重置",
    linkStable: "连接稳定",
    closeTree: "折叠文件树",
    openTree: "展开文件树",
    themeAuto: "跟随系统",
    themeLight: "浅色",
    themeDark: "深色",
    editorSummary: "摘要",
    editorBody: "正文",
    writeFile: "写入文件",
    placeholder: "输入 help 命令获取帮助，输入 / 打开命令菜单。",
  },
  en: {
    friendlyLinks: "FRIENDLY LINKS",
    icpRecord: "ICP filing: pending",
    policeRecord: "Public security filing: pending",
    publicArchive: "PUBLIC ARCHIVE",
    connected: "Link established. Archive indexed with {count} readable signals.",
    browse: "Browse directories",
    read: "Read an article",
    commands: "Open command index",
    systemNominal: "SYSTEM NOMINAL",
    commandIndex: "COMMAND INDEX",
    match: "MATCH",
    usage: "USAGE",
    session: "SESSION",
    active: "ACTIVE",
    administrator: "administrator",
    visitor: "public visitor",
    access: "ACCESS",
    files: "FILES",
    latency: "LATENCY",
    archive: "REMOTE SITE",
    rootTools: "ROOT TOOLS",
    create: "NEW",
    reset: "RESET",
    linkStable: "LINK STABLE",
    closeTree: "Collapse file tree",
    openTree: "Expand file tree",
    themeAuto: "Use system theme",
    themeLight: "Light theme",
    themeDark: "Dark theme",
    editorSummary: "SUMMARY",
    editorBody: "TRANSMISSION BODY",
    writeFile: "WRITE FILE",
    placeholder: "Enter the 'help' command to get helps, enter '/' to invoke the command menu.",
  },
};

const bootEntries = [
  {
    id: "boot-1",
    type: "boot",
  },
];

type Language = "zh" | "en";
type ThemeMode = "auto" | "light" | "dark";
type BlogCategory = { slug: string; label: string; code: string; description: string };
type Entry = {
  id: string;
  type: string;
  value?: string;
  user?: string;
  path?: string;
  article?: Article;
  items?: Article[];
  counts?: Record<string, number>;
  summary?: string;
  onOpen?: (value: string) => void;
};

type ElevatedEditorState = { authorizationToken?: string };
type ArticleEditorState = Article &
  ElevatedEditorState & { mode: "article"; target: "article" | "draft"; buffer: string };
type ConfigEditorState = ElevatedEditorState & { mode: "config"; value: string };
type EditorState = ArticleEditorState | ConfigEditorState;
type PagerState = { fileName: string; value: string };
type PasswordMode =
  | { kind: "su" }
  | { kind: "sudo"; command: string }
  | { kind: "passwd-new"; authorizationToken?: string }
  | { kind: "passwd-confirm"; password: string; authorizationToken?: string };
type ExecutionOptions = {
  effectiveUser?: "guest" | "root";
  authorizationToken?: string;
  echoCommand?: boolean;
  recordHistory?: boolean;
  skipPasswordMode?: boolean;
};

const sortArticles = (items: Article[]) => [...items].sort((a, b) => b.date.localeCompare(a.date));

const articleToBuffer = (article: Article) => serializeArticleDocument(article);

const asciiTree = `                  .
             .   /\\   .
          .     /  \\     .
              _/ /\\ \\_
            _/  /  \\  \\_
           /___/____\\___\\
               ||  ||
            ___||__||___`;

const nyanSignal = `  [=^.^=]  ~~~ R A I N B O W   U P L I N K ~~~
==[|||||]======================================>
  /     \\        SIGNAL LOCKED / 100%`;

function Hollywood() {
  return (
    <pre className="terminal-plain-output">{`PACKET TRACE   0x7F 91 AA 02   0x1C E0 4B 77   0x9A 13 FF 20
SATCOM         AZ 284.32       EL 017.90       LOCKED
PROCESS        parse_signal 42%  index_archive 81%  make_coffee 99%
NOTICE         It looks important. It is mostly decorative. ACCESS GRANTED`}</pre>
  );
}

function EntryOutput({
  entry,
  language,
  sourceAddress,
  colorScheme,
  categories,
}: {
  entry: Entry;
  language: Language;
  sourceAddress: string;
  colorScheme: string;
  categories: BlogCategory[];
}) {
  if (entry.type === "boot") return <BootOutputComponent language={language} sourceAddress={sourceAddress} />;
  if (entry.type === "command") {
    return (
      <div className="command-echo">
        <PromptComponent user={entry.user || "guest"} path={entry.path || "~"} />
        <span>{entry.value}</span>
      </div>
    );
  }
  if (entry.type === "article" && entry.article) return <ArticleOutputComponent article={entry.article} />;
  if (entry.type === "source" && entry.article) return <MarkdownSourceComponent article={entry.article} />;
  if (entry.type === "screenfetch") return <Screenfetch colorScheme={colorScheme} />;
  if (entry.type === "hollywood") return <Hollywood />;
  if (entry.type === "matrix") {
    return (
      <pre className="terminal-plain-output">{`01001110 01001111 01000100 01000101
   10  01  11  SIGNAL  00  01
101101  001011  110010  101010
   FOLLOW THE GREEN PHOSPHOR
011001  101100  001101  111000`}</pre>
    );
  }
  if (entry.type === "pre") return <pre className="terminal-plain-output">{entry.value}</pre>;
  if (entry.type === "article-list") {
    return (
      <div className="terminal-list">
        {(entry.items || []).map((article) => (
          <button key={article.id} type="button" onClick={() => entry.onOpen?.(article.id)}>
            -r--r--r-- {article.date} {article.readTime.padStart(6, " ")} {article.id}.md
          </button>
        ))}
        <span>{entry.summary}</span>
      </div>
    );
  }
  if (entry.type === "category-list") {
    return (
      <div className="terminal-list">
        {categories.map((category) => {
          const count = entry.counts?.[category.slug] || 0;
          return (
            <button key={category.slug} type="button" onClick={() => entry.onOpen?.(category.slug)}>
              {category.slug}/ {String(count).padStart(2, "0")}
            </button>
          );
        })}
      </div>
    );
  }
  if (entry.type === "help") {
    return (
      <div className="help-output">
        {commandReference.map((item) => (
          <div key={item.command} className={item.rootOnly ? "root-command" : ""}>
            <code>{item.syntax}</code>
            <span>{language === "en" ? item.hintEn : item.hint}</span>
            {item.rootOnly && <em>ROOT</em>}
          </div>
        ))}
      </div>
    );
  }
  if (entry.type === "error") return <p className="output-line output-error">ERR: {entry.value}</p>;
  if (entry.type === "success") return <p className="output-line output-success">OK: {entry.value}</p>;
  return <p className="output-line">{entry.value}</p>;
}

type TerminalBlogProps = {
  initialAccessFiles?: AccessFileInfo[];
  initialArticles?: Article[];
  initialCategories?: string[];
  initialConfig?: SiteConfig;
  sourceAddress?: string;
};

export default function TerminalBlog({
  initialAccessFiles = [],
  initialArticles = seedArticles,
  initialCategories = defaultCategories.map((category) => category.slug),
  initialConfig = defaultSiteConfig,
  sourceAddress = "public.gateway",
}: TerminalBlogProps) {
  const [accessFiles, setAccessFiles] = useState<AccessFileInfo[]>(initialAccessFiles);
  const [articles, setArticles] = useState<Article[]>(initialArticles.length ? initialArticles : seedArticles);
  const [currentPath, setCurrentPath] = useState("/");
  const [user, setUser] = useState<"guest" | "root">("guest");
  const [entries, setEntries] = useState<Entry[]>(bootEntries);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const [pendingPassword, setPendingPassword] = useState<PasswordMode | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [pager, setPager] = useState<PagerState | null>(null);
  const [categorySlugs, setCategorySlugs] = useState(
    initialCategories.length ? initialCategories : defaultCategories.map((category) => category.slug),
  );
  const [hydrated, setHydrated] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>("zh");
  const [themeMode, setThemeMode] = useState<ThemeMode>("auto");
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("dark");
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(initialConfig);
  const [windowFocused, setWindowFocused] = useState(true);
  const [insertMode, setInsertMode] = useState(true);
  const [cursorLeft, setCursorLeft] = useState(0);
  const [cursorWidth, setCursorWidth] = useState(8);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const scrollbackPositionRef = useRef(0);
  const restoreScrollbackRef = useRef(false);
  const stagedFilesRef = useRef(new Map<string, File>());
  const nextId = useRef(1);
  const getEntryKey = useCallback((index: number) => entries[index]?.id ?? index, [entries]);
  // TanStack Virtual owns the measurement lifecycle for variable-height terminal entries.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => outputRef.current,
    getItemKey: getEntryKey,
    estimateSize: () => 52,
    overscan: 8,
    measureElement: (element) => element.getBoundingClientRect().height,
  });

  const pathLabel = currentPath === "/" ? "/archive" : `/archive/${currentPath}`;
  const promptPath = currentPath === "/" ? "~" : `~/${currentPath}`;
  const copy = uiText[language];
  const resolvedTheme = themeMode === "auto" ? systemTheme : themeMode;
  const say = (zh: string, en: string) => (language === "en" ? en : zh);
  const categories = useMemo<BlogCategory[]>(
    () =>
      categorySlugs.map((slug) => {
        const configured = defaultCategories.find((category) => category.slug === slug);
        return (
          configured || {
            slug,
            label: slug,
            code: slug.slice(0, 3).toUpperCase(),
            description: "",
          }
        );
      }),
    [categorySlugs],
  );
  const currentArticles = useMemo(
    () =>
      currentPath === "/"
        ? sortArticles(articles)
        : sortArticles(articles.filter((article) => article.category === currentPath)),
    [articles, currentPath],
  );

  useEffect(() => {
    try {
      const storedSettings = window.localStorage.getItem(SETTINGS_KEY);
      if (storedSettings) {
        const settings = JSON.parse(storedSettings) as { language?: Language; themeMode?: ThemeMode };
        if (settings.language === "zh" || settings.language === "en") setLanguage(settings.language);
        if (settings.themeMode === "auto" || settings.themeMode === "light" || settings.themeMode === "dark") {
          setThemeMode(settings.themeMode);
        }
      }
    } catch {
      // A private browser session can disable local storage; the demo still works in memory.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    const onFocus = () => setWindowFocused(true);
    const onBlur = () => setWindowFocused(false);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const updateTheme = () => setSystemTheme(media.matches ? "light" : "dark");
    updateTheme();
    media.addEventListener("change", updateTheme);
    return () => media.removeEventListener("change", updateTheme);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/site-config", { cache: "no-store" })
      .then(async (response) => ({
        config: (await response.json()) as SiteConfig,
        md5: response.headers.get("X-Site-Config-MD5"),
      }))
      .then(({ config, md5 }) => {
        if (!active) return;
        const previousMd5 = window.localStorage.getItem(CONFIG_MD5_KEY);
        if (!previousMd5 || previousMd5 !== md5) setSiteConfig(config);
        if (md5) window.localStorage.setItem(CONFIG_MD5_KEY, md5);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ language, themeMode }));
    } catch {
      // Settings remain available for this session.
    }
  }, [language, themeMode, hydrated]);

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    document.documentElement.style.colorScheme = resolvedTheme;
    document.body.style.background = resolvedTheme === "light" ? "#ffffff" : "#000000";
  }, [language, resolvedTheme]);

  useEffect(() => {
    if (currentPath !== "/") setExpandedFolder(currentPath);
  }, [currentPath]);

  useLayoutEffect(() => {
    if (editor || pager) return undefined;
    const output = outputRef.current;
    if (!output) return undefined;
    if (restoreScrollbackRef.current) {
      restoreScrollbackRef.current = false;
      output.scrollTop = scrollbackPositionRef.current;
      const restoreFrame = window.requestAnimationFrame(() => {
        output.scrollTop = scrollbackPositionRef.current;
      });
      return () => window.cancelAnimationFrame(restoreFrame);
    }
    const frame = window.requestAnimationFrame(() => {
      const area = output.querySelector(".command-area") as HTMLElement | null;
      const end = area ? area.offsetTop + area.offsetHeight : output.scrollHeight;
      output.scrollTo({ top: Math.max(0, end - output.clientHeight), behavior: "smooth" });
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [entries, editor, pager, virtualizer]);

  const syncCursor = useCallback(() => {
    const node = inputRef.current;
    if (!node) return;
    const styles = window.getComputedStyle(node);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return;
    context.font = styles.font;
    const start = node.selectionStart ?? input.length;
    setCursorLeft(context.measureText(input.slice(0, start)).width);
    setCursorWidth(Math.max(7, context.measureText("M").width));
  }, [input]);

  useEffect(() => {
    window.requestAnimationFrame(syncCursor);
  }, [input, insertMode, syncCursor]);

  useEffect(() => {
    if (!contextMenu) return undefined;
    const close = () => setContextMenu(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [contextMenu]);

  const makeEntry = (type: string, data: Omit<Partial<Entry>, "id" | "type"> = {}): Entry => ({
    id: `entry-${nextId.current++}`,
    type,
    ...data,
  });

  const append = (...newEntries: Entry[]) => setEntries((previous) => [...previous, ...newEntries]);

  const captureScrollback = () => {
    scrollbackPositionRef.current = outputRef.current?.scrollTop || 0;
  };

  const openEditor = (nextEditor: EditorState) => {
    captureScrollback();
    setEditor(nextEditor);
  };

  const openPager = (nextPager: PagerState) => {
    captureScrollback();
    setPager(nextPager);
  };

  const closeAlternateScreen = () => {
    restoreScrollbackRef.current = true;
    setEditor(null);
    setPager(null);
  };

  const resolveArticle = (query: string, pool: Article[] = articles): Article | null => {
    if (!query) return null;
    const clean = query.replace(/\.md$/i, "").toLowerCase();
    return (
      pool.find((article) => article.id.toLowerCase() === clean) ||
      pool.find((article) => article.id.toLowerCase().startsWith(clean)) ||
      pool.find((article) => article.title.toLowerCase().includes(clean)) ||
      null
    );
  };

  const resolveCurrentArticle = (query: string) =>
    resolveArticle(
      query,
      currentPath === "/" ? articles : articles.filter((article) => article.category === currentPath),
    );

  const playTick = () => {
    if (typeof window === "undefined") return;
    try {
      const AudioContext =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext;
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = user === "root" ? 260 : 420;
      gain.gain.setValueAtTime(0.025, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.045);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.05);
    } catch {
      // Audio feedback is optional.
    }
  };

  const authenticateRoot = async (password: string) => {
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = (await response.json()) as { ok?: boolean };
      if (result.ok) {
        setUser("root");
        append(
          makeEntry("success", {
            value: say(
              "身份验证通过。管理员工具已挂载到 /bin。",
              "Authentication accepted. Administrator tools mounted at /bin.",
            ),
          }),
        );
      } else {
        append(
          makeEntry("error", {
            value: say("认证失败，当前会话仍为 guest。", "Authentication failed. This session remains guest."),
          }),
        );
      }
    } catch {
      append(makeEntry("error", { value: say("认证服务不可用。", "Authentication service unavailable.") }));
    }
  };

  const authenticateSudo = async (password: string, command: string) => {
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, session: false }),
      });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; token?: string };
      if (!response.ok || !result.ok || !result.token) {
        append(makeEntry("error", { value: say("sudo：密码错误。", "sudo: incorrect password.") }));
        return;
      }
      executeCommand(command, {
        effectiveUser: "root",
        authorizationToken: result.token,
        echoCommand: false,
        recordHistory: false,
        skipPasswordMode: true,
      });
    } catch {
      append(makeEntry("error", { value: say("认证服务不可用。", "Authentication service unavailable.") }));
    }
  };

  const changeRootPassword = async (password: string, authorizationToken?: string) => {
    try {
      const response = await fetch("/api/auth", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(authorizationToken ? { Authorization: `Bearer ${authorizationToken}` } : {}),
        },
        body: JSON.stringify({ password }),
      });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      append(
        response.ok && result.ok
          ? makeEntry("success", { value: say("root 密码已更新。", "Root password updated.") })
          : makeEntry("error", { value: result.error || say("密码更新失败。", "Password update failed.") }),
      );
    } catch {
      append(makeEntry("error", { value: say("认证服务不可用。", "Authentication service unavailable.") }));
    }
  };

  const persistArticle = async (article: Article, previousSourcePath?: string, authorizationToken?: string) => {
    const response = await fetch("/api/articles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authorizationToken ? { Authorization: `Bearer ${authorizationToken}` } : {}),
      },
      body: JSON.stringify({ ...article, previousSourcePath }),
    });
    if (!response.ok) throw new Error("article write failed");
    return response.json() as Promise<{ article: Article }>;
  };

  const executeCommand = (rawValue: string, options: ExecutionOptions = {}) => {
    const submitted = rawValue.trim();
    if (!submitted && !pendingPassword) return;
    const effectiveUser = options.effectiveUser || user;
    const shouldEchoCommand = options.echoCommand !== false;
    const shouldRecordHistory = options.recordHistory !== false;
    playTick();

    if (pendingPassword && !options.skipPasswordMode) {
      setInput("");
      if (pendingPassword.kind === "su") {
        setPendingPassword(null);
        void authenticateRoot(rawValue);
      } else if (pendingPassword.kind === "sudo") {
        setPendingPassword(null);
        void authenticateSudo(rawValue, pendingPassword.command);
      } else if (pendingPassword.kind === "passwd-new") {
        if (rawValue.length < 16) {
          setPendingPassword(null);
          append(
            makeEntry("error", {
              value: say("密码至少需要 16 个字符。", "Password must contain at least 16 characters."),
            }),
          );
        } else {
          setPendingPassword({
            kind: "passwd-confirm",
            password: rawValue,
            authorizationToken: pendingPassword.authorizationToken,
          });
        }
      } else {
        setPendingPassword(null);
        if (rawValue !== pendingPassword.password) {
          append(makeEntry("error", { value: say("两次输入的密码不一致。", "Passwords do not match.") }));
        } else {
          void changeRootPassword(rawValue, pendingPassword.authorizationToken);
        }
      }
      return;
    }

    const normalized = submitted.startsWith("/") && submitted.length > 1 ? submitted.slice(1) : submitted;
    const pipelineStages = splitPipeline(normalized);
    if (pipelineStages.length > 1) {
      const commandEntry = makeEntry("command", { user, path: promptPath, value: submitted });
      if (shouldRecordHistory)
        setHistory((previous) => [submitted, ...previous.filter((item) => item !== submitted)].slice(0, 40));
      setHistoryIndex(-1);
      setInput("");
      if (pipelineStages.some((stage) => !stage)) {
        append(...(shouldEchoCommand ? [commandEntry] : []), makeEntry("error", { value: "pipeline: empty command" }));
        return;
      }
      const result = runTextPipeline(pipelineStages, resolveCurrentArticle);
      append(
        ...(shouldEchoCommand ? [commandEntry] : []),
        makeEntry(result.error ? "error" : "pre", { value: result.error || result.value }),
      );
      return;
    }
    const parts = splitCommand(normalized);
    let command = (parts.shift() || "").toLowerCase();
    const args = parts;
    const commandEntry = makeEntry("command", { user, path: promptPath, value: submitted });
    const appendCommandOutput = (...outputEntries: Entry[]) =>
      append(...(shouldEchoCommand ? [commandEntry] : []), ...outputEntries);
    const definition = findCommand(command);
    if (definition) command = definition.command;
    const usage = definition && validateCommandArguments(definition, args);
    if (usage) {
      appendCommandOutput(makeEntry("error", { value: usage }));
      if (shouldRecordHistory)
        setHistory((previous) => [submitted, ...previous.filter((item) => item !== submitted)].slice(0, 40));
      setHistoryIndex(-1);
      setInput("");
      return;
    }
    if (shouldRecordHistory)
      setHistory((previous) => [submitted, ...previous.filter((item) => item !== submitted)].slice(0, 40));
    setHistoryIndex(-1);
    setInput("");

    if (command === "sudo") {
      const nestedValue = args.join(" ").trim();
      const nestedToken = splitCommand(nestedValue)[0]?.toLowerCase() || "";
      const nestedDefinition = findCommand(nestedToken);
      if (!nestedDefinition) {
        appendCommandOutput(
          makeEntry("error", {
            value: say(`sudo：找不到命令 ${nestedToken}`, `sudo: command not found: ${nestedToken}`),
          }),
        );
      } else if (["sudo", "su", "exit"].includes(nestedDefinition.command)) {
        appendCommandOutput(
          makeEntry("error", {
            value: say(
              `sudo：不支持执行会话命令 ${nestedDefinition.command}`,
              `sudo: session command is not supported: ${nestedDefinition.command}`,
            ),
          }),
        );
      } else {
        if (shouldEchoCommand) append(commandEntry);
        if (effectiveUser === "root") {
          executeCommand(nestedValue, {
            effectiveUser: "root",
            authorizationToken: options.authorizationToken,
            echoCommand: false,
            recordHistory: false,
          });
        } else {
          setPendingPassword({ kind: "sudo", command: nestedValue });
        }
      }
      return;
    }

    if (command === "clear") {
      setEntries([makeEntry("boot")]);
      setPendingPassword(null);
      stagedFilesRef.current.clear();
      return;
    }

    const out: Entry[] = [];
    const error = (value: string) => out.push(makeEntry("error", { value }));
    const success = (value: string) => out.push(makeEntry("success", { value }));
    const text = (value: string) => out.push(makeEntry("text", { value }));

    switch (command) {
      case "":
      case "/":
        out.push(makeEntry("help"));
        break;
      case "help":
      case "man":
        out.push(makeEntry("help"));
        break;
      case "theme": {
        const targetTheme = args[0]?.toLowerCase();
        if (!targetTheme) text(`${say("当前颜色模式", "Current color mode")}: ${themeMode} (${resolvedTheme})`);
        else if (!["auto", "light", "dark"].includes(targetTheme)) error("usage: theme [auto|light|dark]");
        else {
          setThemeMode(targetTheme as ThemeMode);
          success(`${say("颜色模式已切换为", "Color mode switched to")} ${targetTheme}.`);
        }
        break;
      }
      case "lang": {
        const targetLanguage = args[0]?.toLowerCase();
        if (!targetLanguage) text(`${say("当前语言", "Current language")}: ${language}`);
        else if (!["zh", "en"].includes(targetLanguage)) error("usage: lang [zh|en]");
        else {
          setLanguage(targetLanguage as Language);
          success(targetLanguage === "en" ? "Interface language changed to English." : "界面语言已切换为中文。");
        }
        break;
      }
      case "drawer":
      case "tree":
        setRailOpen((value) => !value);
        text(say("辅助文件树状态已切换。", "Helper file tree toggled."));
        break;
      case "pwd":
        text(pathLabel);
        break;
      case "whoami":
        text(`${effectiveUser}  uid=${effectiveUser === "root" ? "0" : "1001"}  session=interactive`);
        break;
      case "date":
        text(new Intl.DateTimeFormat("zh-CN", { dateStyle: "full", timeStyle: "long" }).format(new Date()));
        break;
      case "ls": {
        if (currentPath === "/") {
          const counts = Object.fromEntries(
            categories.map((category) => [
              category.slug,
              articles.filter((article) => article.category === category.slug).length,
            ]),
          );
          out.push(makeEntry("category-list", { counts, onOpen: (slug: string) => executeCommand(`cd ${slug}`) }));
        } else {
          const requestedLimit = Number.parseInt(args[0], 10);
          const requestedPage = Number.parseInt(args[1], 10);
          const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 25) : 10;
          const page = Number.isFinite(requestedPage) ? Math.max(requestedPage, 1) : 1;
          const start = (page - 1) * limit;
          const items = currentArticles.slice(start, start + limit);
          out.push(
            makeEntry("article-list", {
              items,
              summary: `${items.length} / ${currentArticles.length} files | page ${page}`,
              onOpen: (id: string) => executeCommand(`cat ${id}`),
            }),
          );
        }
        break;
      }
      case "cd": {
        const target = args[0] || "/";
        if (["/", "~", "/archive"].includes(target) || target === "..") {
          setCurrentPath("/");
          success("当前位置 /archive");
        } else {
          const slug = target
            .replace(/^\/archive\//, "")
            .replace(/^\//, "")
            .replace(/\/$/, "");
          const category = categories.find(
            (item) => item.slug === slug || item.code.toLowerCase() === slug.toLowerCase(),
          );
          if (!category) error(`目录不存在: ${target}`);
          else {
            setCurrentPath(category.slug);
            success(
              say(
                `进入 /archive/${category.slug}，包含 ${articles.filter((article) => article.category === category.slug).length} 篇记录。`,
                `Entered /archive/${category.slug} with ${articles.filter((article) => article.category === category.slug).length} indexed signals.`,
              ),
            );
          }
        }
        break;
      }
      case "cat": {
        const localPool =
          currentPath === "/" ? articles : articles.filter((article) => article.category === currentPath);
        const finalArgument = args.at(-1)?.toLowerCase();
        const requestedMode = finalArgument && ["source", "render"].includes(finalArgument) ? finalArgument : "render";
        const articleArgs =
          requestedMode === "render" && args.at(-1)?.toLowerCase() !== "render" ? args : args.slice(0, -1);
        const article = resolveArticle(articleArgs.join(" "), localPool);
        if (!articleArgs.length)
          error(
            say(
              "缺少文件名。用法: cat <文章名> [source|render]",
              "Missing article. Usage: cat <article> [source|render]",
            ),
          );
        else if (!article)
          error(
            say(
              `当前目录中找不到文件: ${articleArgs.join(" ")}`,
              `File not found in this directory: ${articleArgs.join(" ")}`,
            ),
          );
        else out.push(makeEntry(requestedMode === "source" ? "source" : "article", { article }));
        break;
      }
      case "less": {
        const article = resolveCurrentArticle(args.join(" "));
        if (!article) {
          error(`less: ${args.join(" ")}: file not found`);
          break;
        }
        openPager({ fileName: `${article.id}.md`, value: articleToBuffer(article) });
        break;
      }
      case "head":
      case "tail":
      case "grep": {
        const result = runTextStage(command, args, resolveCurrentArticle);
        if (result.error) error(result.error);
        else out.push(makeEntry("pre", { value: result.value || "" }));
        break;
      }
      case "stat": {
        const localPool =
          currentPath === "/" ? articles : articles.filter((article) => article.category === currentPath);
        const article = resolveArticle(args.join(" "), localPool);
        if (!article) {
          error(say(`当前目录中找不到文件: ${args.join(" ")}`, `File not found in this directory: ${args.join(" ")}`));
          break;
        }
        out.push(
          makeEntry("pre", {
            value: [
              `${say("标题", "Title")}: ${article.title}`,
              `${say("标识", "Slug")}: ${article.id}`,
              `${say("分类", "Category")}: ${article.category}`,
              `${say("日期", "Date")}: ${article.date}`,
              `${say("阅读时间", "Read time")}: ${article.readTime}`,
              `${say("标签", "Tags")}: ${article.tags.length ? article.tags.join(", ") : "-"}`,
              `${say("拼音", "Pinyin")}: ${article.pinyin || "-"}`,
              `${say("摘要", "Excerpt")}: ${article.excerpt || "-"}`,
              `${say("源文件", "Source path")}: ${article.sourcePath || `articles/${article.category}/${article.id}.md`}`,
            ].join("\n"),
          }),
        );
        break;
      }
      case "history":
        out.push(
          makeEntry("pre", {
            value:
              history.map((item, index) => `${String(index + 1).padStart(3, " ")}  ${item}`).join("\n") ||
              "history is empty",
          }),
        );
        break;
      case "su":
        if (user === "root") text(say("当前会话已经是 root。", "This session is already root."));
        else if (args[0] && args[0] !== "root") error(say(`未知账户: ${args[0]}`, `Unknown account: ${args[0]}`));
        else setPendingPassword({ kind: "su" });
        break;
      case "exit":
      case "logout":
        if (user === "root") {
          setUser("guest");
          void fetch("/api/auth", { method: "DELETE" });
          success(say("root 会话已关闭，返回 guest。", "Root session closed. Returned to guest."));
        } else text(say("这是最后一个会话。连接保持开放。", "This is the final session. The link remains open."));
        break;
      case "nano": {
        if (effectiveUser !== "root")
          error(
            say(
              "权限不足。nano 需要 root 权限，请使用 sudo 或 su root。",
              "Permission denied. nano requires root privileges; use sudo or su root.",
            ),
          );
        else if (["./system/config", "system/config", "/system/config"].includes(args[0]?.toLowerCase())) {
          openEditor({
            mode: "config",
            value: JSON.stringify(siteConfig, null, 2),
            authorizationToken: options.authorizationToken,
          });
        } else {
          const existing = resolveArticle(args.join(" "));
          openEditor(
            existing
              ? {
                  ...existing,
                  mode: "article",
                  target: "article",
                  buffer: articleToBuffer(existing),
                  authorizationToken: options.authorizationToken,
                }
              : {
                  mode: "article",
                  target: "article",
                  id: args[0] || "untitled-signal",
                  title: args.length ? args.join(" ").replace(/-/g, " ") : "Untitled signal",
                  category: currentPath === "/" ? categories[0].slug : currentPath,
                  date: new Date().toISOString().slice(0, 10),
                  readTime: "3 min",
                  excerpt: "",
                  tags: ["notes", "signal"],
                  content: "",
                  authorizationToken: options.authorizationToken,
                  buffer: articleToBuffer({
                    id: args[0] || "untitled-signal",
                    title: args.length ? args.join(" ").replace(/-/g, " ") : "Untitled signal",
                    category: currentPath === "/" ? categories[0].slug : currentPath,
                    date: new Date().toISOString().slice(0, 10),
                    readTime: "3 min",
                    excerpt: "",
                    tags: ["notes", "signal"],
                    content: "",
                  }),
                },
          );
        }
        break;
      }
      case "draft": {
        if (effectiveUser !== "root") {
          error(
            say(
              "权限不足。draft 需要 root 权限，请使用 sudo 或 su root。",
              "Permission denied. draft requires root privileges; use sudo or su root.",
            ),
          );
          break;
        }
        const action = args[0]?.toLowerCase();
        const draftId = args[1];
        const authorizationHeaders = options.authorizationToken
          ? { Authorization: `Bearer ${options.authorizationToken}` }
          : undefined;
        if (action === "new") {
          if (draftId) {
            error("usage: draft new");
            break;
          }
          const id = `draft-${Date.now().toString(36)}`;
          const draft: Article = {
            id,
            title: "Untitled draft",
            category: currentPath === "/" ? categories[0].slug : currentPath,
            date: new Date().toISOString().slice(0, 10),
            readTime: "3 min",
            excerpt: "",
            tags: ["draft"],
            pinyin: "",
            content: "",
          };
          openEditor({
            ...draft,
            mode: "article",
            target: "draft",
            buffer: articleToBuffer(draft),
            authorizationToken: options.authorizationToken,
          });
        } else if (action === "list") {
          if (draftId) {
            error("usage: draft list");
            break;
          }
          void fetch("/api/drafts", { headers: authorizationHeaders, cache: "no-store" })
            .then(async (response) => {
              const result = (await response.json().catch(() => ({}))) as {
                ok?: boolean;
                drafts?: Article[];
                error?: string;
              };
              if (!response.ok || !result.ok || !result.drafts) throw new Error(result.error || "draft list failed");
              append(
                makeEntry("pre", {
                  value: result.drafts.length
                    ? result.drafts
                        .map((draft) => `${draft.id}\t${draft.date}\t${draft.category}\t${draft.title}`)
                        .join("\n")
                    : say("draft/ 目录为空。", "draft/ is empty."),
                }),
              );
            })
            .catch((requestError: Error) =>
              append(
                makeEntry("error", { value: requestError.message || say("草稿列表读取失败。", "Draft list failed.") }),
              ),
            );
        } else if (action === "edit") {
          if (!draftId) {
            error("usage: draft edit <id>");
            break;
          }
          void fetch(`/api/drafts?id=${encodeURIComponent(draftId)}`, {
            headers: authorizationHeaders,
            cache: "no-store",
          })
            .then(async (response) => {
              const result = (await response.json().catch(() => ({}))) as {
                ok?: boolean;
                draft?: Article;
                error?: string;
              };
              if (!response.ok || !result.ok || !result.draft) throw new Error(result.error || "draft not found");
              openEditor({
                ...result.draft,
                mode: "article",
                target: "draft",
                buffer: articleToBuffer(result.draft),
                authorizationToken: options.authorizationToken,
              });
            })
            .catch((requestError: Error) => append(makeEntry("error", { value: requestError.message })));
        } else if (action === "publish") {
          if (!draftId) {
            error("usage: draft publish <id>");
            break;
          }
          void fetch("/api/drafts", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              ...(authorizationHeaders || {}),
            },
            body: JSON.stringify({ id: draftId }),
          })
            .then(async (response) => {
              const result = (await response.json().catch(() => ({}))) as {
                ok?: boolean;
                article?: Article;
                error?: string;
              };
              if (!response.ok || !result.ok || !result.article) throw new Error(result.error || "publish failed");
              const publishedArticle = result.article;
              setArticles((previous) => [
                publishedArticle,
                ...previous.filter((article) => article.id !== publishedArticle.id),
              ]);
              setCategorySlugs((previous) =>
                previous.includes(publishedArticle.category)
                  ? previous
                  : [...previous, publishedArticle.category].sort(),
              );
              append(
                makeEntry("success", {
                  value: `${result.article.id}.md -> /archive/${result.article.category}/`,
                }),
              );
            })
            .catch((requestError: Error) => append(makeEntry("error", { value: requestError.message })));
        } else if (action === "rm") {
          if (!draftId) {
            error("usage: draft rm <id>");
            break;
          }
          void fetch(`/api/drafts?id=${encodeURIComponent(draftId)}`, {
            method: "DELETE",
            headers: authorizationHeaders,
          })
            .then(async (response) => {
              const result = (await response.json().catch(() => ({}))) as {
                ok?: boolean;
                id?: string;
                error?: string;
              };
              if (!response.ok || !result.ok || !result.id) throw new Error(result.error || "draft remove failed");
              append(makeEntry("success", { value: `draft/${result.id}.md removed.` }));
            })
            .catch((requestError: Error) => append(makeEntry("error", { value: requestError.message })));
        } else {
          error("usage: draft <new|list|edit|publish|rm> [id]");
        }
        break;
      }
      case "passwd":
        if (effectiveUser !== "root")
          error(say("权限不足。passwd 仅对 root 开放。", "Permission denied. passwd requires root."));
        else setPendingPassword({ kind: "passwd-new", authorizationToken: options.authorizationToken });
        break;
      case "email": {
        if (effectiveUser !== "root") {
          error(say("权限不足。email 仅对 root 开放。", "Permission denied. email requires root."));
          break;
        }
        if (!args[0]) {
          text(siteConfig.contactEmail);
          break;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args[0])) {
          error(say("邮箱地址无效。", "Invalid email address."));
          break;
        }
        void fetch("/api/site-config", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(options.authorizationToken ? { Authorization: `Bearer ${options.authorizationToken}` } : {}),
          },
          body: JSON.stringify({ ...siteConfig, contactEmail: args[0] }),
        })
          .then(async (response) => {
            const result = (await response.json().catch(() => ({}))) as { ok?: boolean; config?: SiteConfig };
            if (!response.ok || !result.ok || !result.config) throw new Error("email write failed");
            setSiteConfig(result.config);
            append(makeEntry("success", { value: say("联系邮箱已更新。", "Contact email updated.") }));
          })
          .catch(() =>
            append(makeEntry("error", { value: say("联系邮箱更新失败。", "Contact email update failed.") })),
          );
        break;
      }
      case "mv": {
        if (effectiveUser !== "root")
          error(say("权限不足。mv 仅对 root 开放。", "Permission denied. mv requires root."));
        else if (args.length < 2) error("用法: mv <文章名> <分类>");
        else {
          const article = resolveArticle(args[0]);
          const target = categories.find((category) => category.slug === args[1].replace(/\/$/, ""));
          if (!article) error(`找不到文章: ${args[0]}`);
          else if (!target) error(`找不到分类: ${args[1]}`);
          else {
            void fetch("/api/articles", {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                ...(options.authorizationToken ? { Authorization: `Bearer ${options.authorizationToken}` } : {}),
              },
              body: JSON.stringify({ id: article.id, category: target.slug }),
            })
              .then(async (response) => {
                const result = (await response.json().catch(() => ({}))) as {
                  ok?: boolean;
                  article?: Article;
                  error?: string;
                };
                if (!response.ok || !result.ok || !result.article) throw new Error(result.error || "move failed");
                setArticles((previous) => previous.map((item) => (item.id === article.id ? result.article! : item)));
                success(`${article.id}.md -> /archive/${target.slug}/`);
              })
              .catch(() =>
                append(
                  makeEntry("error", {
                    value: say("文章移动失败，远端文件未更新。", "Move failed; remote file was not updated."),
                  }),
                ),
              );
          }
        }
        break;
      }
      case "mkdir": {
        if (effectiveUser !== "root") {
          error(say("权限不足。mkdir 仅对 root 开放。", "Permission denied. mkdir requires root."));
          break;
        }
        const requestedCategory = args.join(" ");
        void fetch("/api/categories", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(options.authorizationToken ? { Authorization: `Bearer ${options.authorizationToken}` } : {}),
          },
          body: JSON.stringify({ category: requestedCategory }),
        })
          .then(async (response) => {
            const result = (await response.json().catch(() => ({}))) as {
              ok?: boolean;
              category?: string;
              error?: string;
            };
            if (!response.ok || !result.ok || !result.category) throw new Error(result.error || "mkdir failed");
            const category = result.category;
            setCategorySlugs((previous) => (previous.includes(category) ? previous : [...previous, category].sort()));
            append(makeEntry("success", { value: `articles/${category}/ created.` }));
          })
          .catch((requestError: Error) => append(makeEntry("error", { value: requestError.message })));
        break;
      }
      case "upload": {
        if (effectiveUser !== "root") {
          error(
            say(
              "权限不足。upload 需要 root 权限，请使用 sudo 或 su root。",
              "Permission denied. upload requires root privileges; use sudo or su root.",
            ),
          );
          break;
        }
        const [remoteUri, targetPath] = args;
        const file = stagedFilesRef.current.get(remoteUri);
        if (!file) {
          error(
            say(
              `upload: 找不到暂存文件 ${remoteUri}，请重新拖入终端。`,
              `upload: staged file not found: ${remoteUri}; drop it onto the terminal again.`,
            ),
          );
          break;
        }
        const formData = new FormData();
        formData.set("file", file);
        formData.set("targetPath", targetPath);
        void fetch("/api/upload", {
          method: "POST",
          headers: options.authorizationToken ? { Authorization: `Bearer ${options.authorizationToken}` } : undefined,
          body: formData,
        })
          .then(async (response) => {
            const result = (await response.json().catch(() => ({}))) as {
              ok?: boolean;
              error?: string;
              sourcePath?: string;
              articles?: Article[];
              categories?: string[];
              accessFiles?: AccessFileInfo[];
            };
            if (
              !response.ok ||
              !result.ok ||
              !result.sourcePath ||
              !Array.isArray(result.articles) ||
              !Array.isArray(result.categories) ||
              !Array.isArray(result.accessFiles)
            ) {
              throw new Error(result.error || "upload failed");
            }
            setArticles(result.articles);
            setCategorySlugs(result.categories);
            setAccessFiles(result.accessFiles);
            stagedFilesRef.current.delete(remoteUri);
            append(makeEntry("success", { value: `${remoteUri} -> ${result.sourcePath}` }));
          })
          .catch((requestError: Error) => append(makeEntry("error", { value: `upload: ${requestError.message}` })));
        break;
      }
      case "rm": {
        if (effectiveUser !== "root")
          error(say("权限不足。rm 仅对 root 开放。", "Permission denied. rm requires root."));
        else if (!args.length) error("用法: rm <文章名>");
        else {
          const article = resolveArticle(args.join(" "));
          if (!article) error(`找不到文章: ${args.join(" ")}`);
          else {
            void fetch(`/api/articles?id=${encodeURIComponent(article.id)}`, {
              method: "DELETE",
              headers: options.authorizationToken
                ? { Authorization: `Bearer ${options.authorizationToken}` }
                : undefined,
            })
              .then(async (response) => {
                const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
                if (!response.ok || !result.ok) throw new Error(result.error || "remove failed");
                setArticles((previous) => previous.filter((item) => item.id !== article.id));
                success(`${article.id}.md 已从索引移除。`);
              })
              .catch(() =>
                append(
                  makeEntry("error", {
                    value: say("删除失败，远端文件仍然存在。", "Remove failed; remote file is still present."),
                  }),
                ),
              );
          }
        }
        break;
      }
      case "reset":
        if (effectiveUser !== "root") error("权限不足。reset 仅对 root 开放。");
        else {
          setArticles(seedArticles);
          success("示例档案已恢复。 ");
        }
        break;
      case "search": {
        const filters: { query: string; tags: string[]; category?: string; from?: string; to?: string } = {
          query: "",
          tags: [],
        };
        const queryParts: string[] = [];
        let invalidFilter = false;
        for (let index = 0; index < args.length; index += 1) {
          const token = args[index];
          const next = args[index + 1];
          if (["--tag", "-t"].includes(token)) {
            if (!next) {
              invalidFilter = true;
              break;
            }
            filters.tags.push(next.replace(/^#/, ""));
            index += 1;
          } else if (token.startsWith("--tag=")) {
            filters.tags.push(token.slice("--tag=".length).replace(/^#/, ""));
          } else if (token.startsWith("tag:")) {
            filters.tags.push(token.slice("tag:".length).replace(/^#/, ""));
          } else if (token.startsWith("#") && token.length > 1) {
            filters.tags.push(token.slice(1));
          } else if (["--category", "-c"].includes(token)) {
            if (!next) {
              invalidFilter = true;
              break;
            }
            filters.category = next;
            index += 1;
          } else if (token.startsWith("--category=")) {
            filters.category = token.slice("--category=".length);
          } else if (["--from", "-f"].includes(token)) {
            if (!next) {
              invalidFilter = true;
              break;
            }
            filters.from = next;
            index += 1;
          } else if (token.startsWith("--from=")) {
            filters.from = token.slice("--from=".length);
          } else if (["--to", "-u"].includes(token)) {
            if (!next) {
              invalidFilter = true;
              break;
            }
            filters.to = next;
            index += 1;
          } else if (token.startsWith("--to=")) {
            filters.to = token.slice("--to=".length);
          } else queryParts.push(token);
        }
        if (invalidFilter || filters.tags.some((tag) => !tag)) {
          error("usage: search [query...] [--tag <tag>] [--category <category>] [--from <date>] [--to <date>]");
          break;
        }
        filters.query = queryParts.join(" ");
        const normalize = (value: string) => value.toLocaleLowerCase().replace(/[\s_-]+/g, "");
        const query = normalize(filters.query);
        const results = articles.filter((article) => {
          const pinyin = normalize(article.pinyin || "");
          const pinyinInitials = (article.pinyin || "")
            .split(/[\s_-]+/)
            .filter(Boolean)
            .map((part) => part[0])
            .join("")
            .toLocaleLowerCase();
          const haystack = normalize(
            [article.id, article.title, article.category, article.excerpt, ...article.tags].join(" "),
          );
          return (
            (!query || haystack.includes(query) || pinyin.includes(query) || pinyinInitials.includes(query)) &&
            filters.tags.every((requestedTag) =>
              article.tags.some((tag) => tag.toLocaleLowerCase() === requestedTag.toLocaleLowerCase()),
            ) &&
            (!filters.category || article.category.toLocaleLowerCase() === filters.category.toLocaleLowerCase()) &&
            (!filters.from || article.date >= filters.from) &&
            (!filters.to || article.date <= filters.to)
          );
        });
        out.push(
          makeEntry("article-list", {
            items: sortArticles(results),
            summary: `${results.length} ${say("个匹配结果", "matches")}${filters.tags.length ? ` · tags: ${filters.tags.join(",")}` : ""}${filters.category ? ` · ${filters.category}` : ""}`,
            onOpen: (id: string) => executeCommand(`cat ${id}`),
          }),
        );
        break;
      }
      case "screenfetch":
        out.push(makeEntry("screenfetch"));
        break;
      case "cmatrix":
      case "matrix":
        out.push(makeEntry("matrix"));
        break;
      case "hollywood":
        out.push(makeEntry("hollywood"));
        break;
      case "cbonsai":
        out.push(makeEntry("pre", { value: asciiTree }));
        break;
      case "cowsay": {
        const message = args.join(" ") || "The quiet web is still alive.";
        const line = "-".repeat(Math.min(message.length + 2, 48));
        out.push(
          makeEntry("pre", {
            value: ` ${line}\n< ${message.slice(0, 46)} >\n ${line}\n        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||`,
          }),
        );
        break;
      }
      case "nyancat":
        out.push(makeEntry("pre", { value: nyanSignal }));
        break;
      default:
        error(
          say(
            `command not found: ${command}. 输入 / 查看命令索引。`,
            `command not found: ${command}. Enter / for the command index.`,
          ),
        );
    }

    appendCommandOutput(...out);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const cleanInput = input.startsWith("/") ? input.slice(1) : input;
  const commandToken = cleanInput.trimStart().split(/\s+/)[0].toLowerCase();
  const commandOnly = !/\s/.test(cleanInput.trimStart());
  const availableCommands = commandReference.filter((item) => !item.rootOnly || user === "root");
  const candidateCommands = commandOnly
    ? availableCommands.filter((item) => !commandToken || item.command.startsWith(commandToken))
    : [];
  const hasExactCommand = candidateCommands.some((item) => item.command === commandToken);
  const paletteItems =
    !pendingPassword &&
    commandOnly &&
    (input.startsWith("/") || commandToken.length > 0) &&
    (!hasExactCommand || candidateCommands.length > 1)
      ? candidateCommands.slice(0, 7)
      : [];
  const activeReference = commandReference.find(
    (item) => item.command === commandToken && (!item.rootOnly || user === "root"),
  );

  useEffect(() => {
    if (!paletteItems.length && !(input && activeReference)) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const output = outputRef.current;
      if (!output) return;
      const area = output.querySelector(".command-area") as HTMLElement | null;
      const end = area ? area.offsetTop + area.offsetHeight : output.scrollHeight;
      output.scrollTo({ top: Math.max(0, end - output.clientHeight), behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeReference, input, paletteItems.length]);

  useEffect(() => {
    setSuggestionIndex(-1);
  }, [input, pendingPassword, user]);

  const acceptSuggestion = (item?: CommandDefinition) => {
    if (!item) return;
    setInput(`${item.command} `);
    setSuggestionIndex(-1);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const updateInput = (value: string, position = value.length) => {
    setInput(value);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(position, position);
      syncCursor();
    });
  };

  const insertTextAtCursor = (value: string) => {
    const node = inputRef.current;
    const start = node?.selectionStart ?? input.length;
    const end = node?.selectionEnd ?? start;
    updateInput(`${input.slice(0, start)}${value}${input.slice(end)}`, start + value.length);
  };

  const copyTerminalSelection = async () => {
    const selection =
      window.getSelection()?.toString() ||
      input.slice(inputRef.current?.selectionStart ?? 0, inputRef.current?.selectionEnd ?? 0);
    if (selection) await navigator.clipboard?.writeText(selection);
  };

  const pasteClipboard = async () => {
    const value = await navigator.clipboard?.readText();
    if (value) insertTextAtCursor(value);
  };

  const pasteSelection = () => {
    const selection = window.getSelection()?.toString();
    if (selection) insertTextAtCursor(selection);
  };

  const selectTerminalBuffer = () => {
    const node = outputRef.current;
    if (!node) return;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(node);
    selection?.addRange(range);
  };

  const clearTerminal = () => {
    setEntries([makeEntry("boot")]);
    setPendingPassword(null);
    stagedFilesRef.current.clear();
  };

  const handleFileDrop = (event: DragEvent<HTMLDivElement>) => {
    if (editor || pager || !event.dataTransfer.files.length) return;
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    const remoteUri = `remote:///${file.name.replaceAll('"', "%22")}`;
    stagedFilesRef.current.set(remoteUri, file);
    const fileArgument = /\s/.test(remoteUri) ? `"${remoteUri}"` : remoteUri;
    updateInput(`upload ${fileArgument} `);
    window.requestAnimationFrame(() => inputRef.current?.scrollIntoView({ block: "nearest" }));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Insert") {
      event.preventDefault();
      setInsertMode((mode) => !mode);
      return;
    }
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "c") {
      event.preventDefault();
      void copyTerminalSelection();
      return;
    }
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "v") {
      event.preventDefault();
      void pasteClipboard();
      return;
    }
    if (event.ctrlKey && !event.shiftKey && ["c", "v"].includes(event.key.toLowerCase())) {
      event.preventDefault();
      return;
    }
    if (!insertMode && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const node = inputRef.current;
      const start = node?.selectionStart ?? input.length;
      const end = node?.selectionEnd ?? start;
      updateInput(`${input.slice(0, start)}${event.key}${input.slice(end + (start === end ? 1 : 0))}`, start + 1);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (paletteItems.length > 0 && suggestionIndex >= 0) acceptSuggestion(paletteItems[suggestionIndex]);
      else if (paletteItems.length > 0 && !activeReference) acceptSuggestion(paletteItems[0]);
      else executeCommand(input);
    } else if (event.key === "Tab") {
      event.preventDefault();
      if (paletteItems.length > 0) {
        acceptSuggestion(paletteItems[suggestionIndex >= 0 ? suggestionIndex : 0]);
        return;
      }
      const tokens = cleanInput.split(/\s+/);
      if (tokens.length === 1) {
        const match = commandReference.find(
          (item) => (!item.rootOnly || user === "root") && item.command.startsWith(tokens[0].toLowerCase()),
        );
        if (match) setInput(`${match.command} `);
      } else if (tokens[0] === "cd") {
        const match = categories.find((category) => category.slug.startsWith(tokens[1]?.toLowerCase() || ""));
        if (match) setInput(`cd ${match.slug}`);
      } else if (tokens[0] === "sudo" && tokens.length === 2) {
        const blockedCommands = new Set(["sudo", "su", "exit"]);
        const match = commandReference.find(
          (item) => !blockedCommands.has(item.command) && item.command.startsWith(tokens[1]?.toLowerCase() || ""),
        );
        if (match) setInput(`sudo ${match.command} `);
      } else if (tokens[0] === "draft" && tokens.length === 2) {
        const match = ["new", "list", "edit", "publish", "rm"].find((action) =>
          action.startsWith(tokens[1]?.toLowerCase() || ""),
        );
        if (match) setInput(`draft ${match}${["edit", "publish", "rm"].includes(match) ? " " : ""}`);
      } else if (["cat", "nano", "rm", "stat", "less"].includes(tokens[0])) {
        if (tokens[0] === "cat" && tokens.length >= 3) {
          const mode = ["source", "render"].find((item) => item.startsWith(tokens[2]?.toLowerCase() || ""));
          if (mode) setInput(`cat ${tokens[1]} ${mode}`);
        } else {
          const match = currentArticles.find((article) => article.id.startsWith(tokens[1]?.toLowerCase() || ""));
          if (match) setInput(`${tokens[0]} ${match.id}${tokens[0] === "cat" ? " " : ""}`);
        }
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (paletteItems.length > 0) {
        setSuggestionIndex((index) => (index <= 0 ? paletteItems.length - 1 : index - 1));
        return;
      }
      const next = Math.min(historyIndex + 1, history.length - 1);
      if (next >= 0) {
        setHistoryIndex(next);
        setInput(history[next]);
      }
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      if (paletteItems.length > 0) {
        setSuggestionIndex((index) => (index >= paletteItems.length - 1 ? 0 : index + 1));
        return;
      }
      const next = historyIndex - 1;
      setHistoryIndex(next);
      setInput(next >= 0 ? history[next] : "");
    } else if (event.key === "Escape") {
      setInput("");
      setSuggestionIndex(-1);
    }
  };

  const saveEditor = async () => {
    if (!editor) return;
    if (editor.mode === "config") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(editor.value);
      } catch {
        throw new Error(say("配置不是有效的 JSON。", "Configuration is not valid JSON."));
      }
      const response = await fetch("/api/site-config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(editor.authorizationToken ? { Authorization: `Bearer ${editor.authorizationToken}` } : {}),
        },
        body: JSON.stringify(parsed),
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        config?: SiteConfig;
        error?: string;
      };
      if (!response.ok || !result.ok || !result.config) {
        throw new Error(result.error || say("配置写入失败。", "Configuration write failed."));
      }
      setSiteConfig(result.config);
      const md5 = response.headers.get("X-Site-Config-MD5");
      if (md5) window.localStorage.setItem(CONFIG_MD5_KEY, md5);
      return;
    }
    const parsed = parseFrontmatter(editor.buffer);
    const metadata = parsed.metadata;
    const metadataTags = Array.isArray(metadata.tags) ? metadata.tags : editor.tags;
    const slug =
      String(metadata.slug || editor.id)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-|-$/g, "") || `signal-${Date.now()}`;
    const nextArticle: Article = {
      id: slug,
      title: String(metadata.title || editor.title).trim() || "Untitled signal",
      category: String(metadata.category || editor.category),
      date: String(metadata.date || editor.date),
      readTime: String(metadata.readTime || editor.readTime || "3 min"),
      excerpt: String(metadata.excerpt || editor.excerpt).trim(),
      content: parsed.content.trim() || (editor.target === "draft" ? "" : "No transmission body."),
      tags: metadataTags.map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean),
      pinyin: String(metadata.pinyin || editor.pinyin || ""),
    };
    const previousSourcePath = editor.sourcePath;
    if (editor.target === "draft") {
      const response = await fetch("/api/drafts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(editor.authorizationToken ? { Authorization: `Bearer ${editor.authorizationToken}` } : {}),
        },
        body: JSON.stringify({ ...nextArticle, previousSourcePath }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        draft?: Article;
        error?: string;
      };
      if (!response.ok || !result.ok || !result.draft) {
        throw new Error(result.error || say("草稿写入失败。", "Draft write failed."));
      }
      setEditor((currentEditor) =>
        currentEditor?.mode === "article" && currentEditor.target === "draft"
          ? { ...currentEditor, ...result.draft, buffer: currentEditor.buffer }
          : currentEditor,
      );
      return;
    }
    const result = await persistArticle(nextArticle, previousSourcePath, editor.authorizationToken);
    setCategorySlugs((previous) =>
      previous.includes(result.article.category) ? previous : [...previous, result.article.category].sort(),
    );
    setArticles((previous) => {
      const exists = previous.some((article) => article.id === editor.id);
      return exists
        ? previous.map((article) => (article.id === editor.id ? result.article : article))
        : [result.article, ...previous];
    });
  };

  return (
    <main className={`site-shell theme-${resolvedTheme}`}>
      <section className={`workspace ${railOpen ? "" : "rail-collapsed"}`}>
        <div className={`terminal-window ${windowFocused ? "window-focused" : "window-blurred"}`}>
          <div className="terminal-bar">
            <div className="window-controls" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <div className="terminal-location">
              <Command size={14} suppressHydrationWarning />
              <b>{siteConfig.blogName}</b>
              <ChevronRight size={13} suppressHydrationWarning />
              <b>{pathLabel}</b>
            </div>
            <span className="terminal-bar-spacer" aria-hidden="true" />
          </div>

          <div
            className="terminal-body"
            onClick={() => {
              setContextMenu(null);
              if (editor || pager) return;
              const selection = window.getSelection();
              if (selection && !selection.isCollapsed) return;
              inputRef.current?.focus();
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              setContextMenu({ x: event.clientX, y: event.clientY });
            }}
            onMouseDown={(event) => {
              if (event.button === 1) {
                event.preventDefault();
                void pasteClipboard();
              }
            }}
            onDragOver={(event) => {
              if (editor || pager || !event.dataTransfer.types.includes("Files")) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }}
            onDrop={handleFileDrop}
          >
            <div className={`terminal-output ${editor || pager ? "alternate-screen" : ""}`} ref={outputRef}>
              {editor ? (
                <NanoEditor
                  fileName={
                    editor.mode === "config"
                      ? "./system/config"
                      : `${editor.target === "draft" ? "draft/" : ""}${editor.id}.md`
                  }
                  value={editor.mode === "config" ? editor.value : editor.buffer}
                  onChange={(value) =>
                    setEditor(editor.mode === "config" ? { ...editor, value } : { ...editor, buffer: value })
                  }
                  onSave={saveEditor}
                  onExit={closeAlternateScreen}
                />
              ) : pager ? (
                <LessViewer fileName={pager.fileName} value={pager.value} onExit={closeAlternateScreen} />
              ) : (
                <>
                  <div className="terminal-output-content" style={{ height: virtualizer.getTotalSize() }}>
                    {virtualizer.getVirtualItems().map((virtualItem) => {
                      const entry = entries[virtualItem.index];
                      return (
                        <div
                          key={virtualItem.key}
                          data-index={virtualItem.index}
                          ref={virtualizer.measureElement}
                          className="terminal-entry"
                          style={{ transform: `translateY(${virtualItem.start}px)` }}
                        >
                          <EntryOutput
                            entry={entry}
                            language={language}
                            sourceAddress={sourceAddress}
                            colorScheme={resolvedTheme}
                            categories={categories}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="command-area">
                    <form
                      className={`terminal-input ${pendingPassword ? "password-mode" : ""} ${insertMode ? "insert-mode" : "overwrite-mode"}`}
                      onSubmit={(event) => {
                        event.preventDefault();
                        executeCommand(input);
                      }}
                    >
                      {!pendingPassword && <PromptComponent user={user} path={promptPath} />}
                      <span className="input-wrap">
                        <input
                          ref={inputRef}
                          type={pendingPassword ? "password" : "text"}
                          value={input}
                          onChange={(event) => {
                            setInput(event.target.value);
                            window.requestAnimationFrame(syncCursor);
                          }}
                          onKeyDown={handleKeyDown}
                          onKeyUp={syncCursor}
                          onSelect={syncCursor}
                          onClick={syncCursor}
                          onFocus={syncCursor}
                          autoComplete="off"
                          autoCapitalize="off"
                          spellCheck="false"
                          aria-label={pendingPassword ? "Password" : "Terminal command"}
                          placeholder={pendingPassword ? "" : copy.placeholder}
                          autoFocus
                        />
                        <span
                          className="input-cursor"
                          style={{ left: cursorLeft, width: cursorWidth }}
                          aria-hidden="true"
                        />
                      </span>
                    </form>
                    {paletteItems.length > 0 && (
                      <div className="command-palette" role="listbox" aria-label={copy.commandIndex}>
                        <div className="palette-label">
                          <span>{copy.commandIndex}</span>
                          <span>
                            {String(paletteItems.length).padStart(2, "0")} {copy.match}
                          </span>
                        </div>
                        {paletteItems.map((item, index) => (
                          <button
                            key={item.command}
                            type="button"
                            role="option"
                            aria-selected={index === suggestionIndex}
                            className={index === suggestionIndex ? "selected" : ""}
                            onMouseDown={(event) => event.preventDefault()}
                            onMouseEnter={() => setSuggestionIndex(index)}
                            onClick={() => acceptSuggestion(item)}
                          >
                            <span className="palette-number">{String(index + 1).padStart(2, "0")}</span>
                            <code>{item.command}</code>
                            <span>{language === "en" ? item.hintEn : item.hint}</span>
                            <em>{item.syntax}</em>
                          </button>
                        ))}
                      </div>
                    )}
                    {paletteItems.length === 0 && input && activeReference && (
                      <div className="argument-hint">
                        <span>{copy.usage}</span>
                        <code>{activeReference.syntax}</code>
                        <em>{language === "en" ? activeReference.hintEn : activeReference.hint}</em>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {contextMenu && (
          <TerminalContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onCopy={() => {
              void copyTerminalSelection();
              setContextMenu(null);
            }}
            onPaste={() => {
              void pasteClipboard();
              setContextMenu(null);
            }}
            onPasteSelection={() => {
              pasteSelection();
              setContextMenu(null);
            }}
            onSelectAll={() => {
              selectTerminalBuffer();
              setContextMenu(null);
            }}
            onClear={() => {
              clearTerminal();
              setContextMenu(null);
            }}
          />
        )}

        <aside className={`side-rail ${railOpen ? "open" : "collapsed"}`}>
          {!railOpen ? (
            <div className="collapsed-rail">
              <button type="button" onClick={() => setRailOpen(true)} title={copy.openTree}>
                <PanelRightOpen size={17} suppressHydrationWarning />
              </button>
              <span
                className={user === "root" ? "mini-status root-mini" : "mini-status"}
                title={`${copy.session}: ${user}`}
              >
                {user === "root" ? (
                  <ShieldCheck size={16} suppressHydrationWarning />
                ) : (
                  <CircleUserRound size={16} suppressHydrationWarning />
                )}
              </span>
              <button type="button" onClick={() => setRailOpen(true)} title={copy.archive}>
                <FolderOpen size={17} suppressHydrationWarning />
                <small>{articles.length}</small>
              </button>
            </div>
          ) : (
            <>
              <div className="rail-titlebar">
                <span>
                  <FolderOpen size={14} suppressHydrationWarning /> {copy.archive}
                </span>
                <button type="button" onClick={() => setRailOpen(false)} title={copy.closeTree}>
                  <PanelRightClose size={16} suppressHydrationWarning />
                </button>
              </div>

              <section className="rail-section session-panel">
                <div className="identity-row">
                  <span className={user === "root" ? "avatar root-avatar" : "avatar"}>
                    {user === "root" ? (
                      <ShieldCheck size={18} suppressHydrationWarning />
                    ) : (
                      <CircleUserRound size={18} suppressHydrationWarning />
                    )}
                  </span>
                  <div>
                    <b>{user}</b>
                    <span>{user === "root" ? copy.administrator : copy.visitor}</span>
                  </div>
                </div>
                <dl className="session-stats">
                  <div>
                    <dt>{copy.access}</dt>
                    <dd>{user === "root" ? "RW" : "READ"}</dd>
                  </div>
                  <div>
                    <dt>{copy.files}</dt>
                    <dd>{String(articles.length).padStart(2, "0")}</dd>
                  </div>
                </dl>
              </section>

              <section className="rail-section ftp-panel">
                <div className="rail-heading">
                  <span>{copy.archive}</span>
                </div>
                <div className="ftp-tree">
                  <button
                    type="button"
                    className={`ftp-root ${currentPath === "/" ? "active" : ""}`}
                    onClick={() => executeCommand("cd /")}
                  >
                    <span>
                      <FolderOpen size={14} suppressHydrationWarning /> archive
                    </span>
                    <em>{String(articles.length).padStart(2, "0")}</em>
                  </button>
                  {categories.map((category) => {
                    const folderArticles = sortArticles(
                      articles.filter((article) => article.category === category.slug),
                    );
                    const expanded = expandedFolder === category.slug;
                    return (
                      <div className="ftp-folder" key={category.slug}>
                        <button
                          type="button"
                          className={currentPath === category.slug ? "active" : ""}
                          onClick={() => {
                            setExpandedFolder(expanded ? null : category.slug);
                            if (currentPath !== category.slug) executeCommand(`cd ${category.slug}`);
                          }}
                        >
                          <ChevronRight
                            size={12}
                            className={expanded ? "tree-chevron open" : "tree-chevron"}
                            suppressHydrationWarning
                          />
                          <FolderInput size={13} suppressHydrationWarning />
                          <span>{category.slug}</span>
                          <em>{String(folderArticles.length).padStart(2, "0")}</em>
                        </button>
                        {expanded && (
                          <div className="ftp-files">
                            {folderArticles.map((article) => (
                              <button
                                type="button"
                                key={article.id}
                                onClick={() => executeCommand(`cat ${article.id}`)}
                                title={article.title}
                              >
                                <BookOpenText size={11} suppressHydrationWarning />
                                <span>{article.id}.md</span>
                                <small>{article.readTime}</small>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="ftp-folder">
                    <button
                      type="button"
                      onClick={() => setExpandedFolder(expandedFolder === ACCESS_FOLDER_KEY ? null : ACCESS_FOLDER_KEY)}
                    >
                      <ChevronRight
                        size={12}
                        className={expandedFolder === ACCESS_FOLDER_KEY ? "tree-chevron open" : "tree-chevron"}
                        suppressHydrationWarning
                      />
                      <ImageIcon size={13} suppressHydrationWarning />
                      <span>access</span>
                      <em>{String(accessFiles.length).padStart(2, "0")}</em>
                    </button>
                    {expandedFolder === ACCESS_FOLDER_KEY && (
                      <div className="ftp-files access-files">
                        {accessFiles.map((file) => (
                          <a key={file.path} href={file.url} target="_blank" rel="noreferrer" title={file.path}>
                            <ImageIcon size={11} suppressHydrationWarning />
                            <span>{file.path}</span>
                            <small>{Math.max(1, Math.ceil(file.size / 1024))}K</small>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>
              <footer className="rail-footer">
                <span>{copy.friendlyLinks}</span>
                <div className="rail-footer-links">
                  {siteConfig.friendlyLinks.map((link) => (
                    <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
                      {link.label}
                    </a>
                  ))}
                </div>
                <small>{siteConfig.filings.icp}</small>
                <small>{siteConfig.filings.police}</small>
              </footer>
            </>
          )}
        </aside>
      </section>
    </main>
  );
}
