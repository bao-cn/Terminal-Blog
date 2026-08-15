export type CommandArgument = {
  name: string;
  description: string;
  descriptionEn: string;
  optional?: boolean;
  variadic?: boolean;
  choices?: readonly string[];
};

export type CommandDefinition = {
  command: string;
  syntax?: string;
  aliases?: readonly string[];
  description: string;
  descriptionEn: string;
  arguments?: readonly CommandArgument[];
  rootOnly?: boolean;
  hidden?: boolean;
};

const argumentToken = (argument: CommandArgument) => {
  const value = argument.choices?.length ? argument.choices.join("|") : argument.name;
  const suffix = argument.variadic ? "..." : "";
  return argument.optional ? `[${value}${suffix}]` : `<${value}${suffix}>`;
};

export const getCommandSyntax = (definition: CommandDefinition) =>
  definition.syntax || [definition.command, ...(definition.arguments || []).map(argumentToken)].join(" ");

export const commandRegistry: readonly CommandDefinition[] = [
  {
    command: "ls",
    description: "列出当前目录内容；默认 10 条，第 1 页",
    descriptionEn: "List this directory; defaults to 10 items on page 1",
    arguments: [
      { name: "limit", description: "每页数量", descriptionEn: "items per page", optional: true },
      { name: "page", description: "页码", descriptionEn: "page number", optional: true },
    ],
  },
  {
    command: "cd",
    description: "切换文章分类",
    descriptionEn: "Change the active article category",
    arguments: [{ name: "category|..|/", description: "目标分类", descriptionEn: "target category", optional: true }],
  },
  {
    command: "cat",
    description: "阅读渲染文章，或查看 Markdown 源文件",
    descriptionEn: "Read a rendered article or inspect its Markdown source",
    arguments: [
      { name: "article", description: "文章文件", descriptionEn: "article file" },
      {
        name: "mode",
        description: "输出模式",
        descriptionEn: "output mode",
        optional: true,
        choices: ["source", "render"],
      },
    ],
  },
  {
    command: "less",
    description: "分页查看文章源文件；按 Q 退出",
    descriptionEn: "Page through an article source file; press Q to exit",
    arguments: [{ name: "article", description: "文章文件", descriptionEn: "article file", variadic: true }],
  },
  {
    command: "head",
    syntax: "head [option]... <article>",
    description: "查看文章开头；支持 -n 行数与 -c 字节数",
    descriptionEn: "Show the beginning of an article with -n lines or -c bytes",
    arguments: [
      {
        name: "input",
        description: "选项与文章文件",
        descriptionEn: "options and article file",
        variadic: true,
      },
    ],
  },
  {
    command: "tail",
    syntax: "tail [option]... <article>",
    description: "查看文章末尾；支持 -n 行数与 -c 字节数",
    descriptionEn: "Show the end of an article with -n lines or -c bytes",
    arguments: [
      {
        name: "input",
        description: "选项与文章文件",
        descriptionEn: "options and article file",
        variadic: true,
      },
    ],
  },
  {
    command: "grep",
    description: "在文章内容或管道输入中搜索文本",
    descriptionEn: "Search article content or piped text",
    arguments: [
      { name: "query", description: "搜索内容", descriptionEn: "search text" },
      { name: "article", description: "文章文件", descriptionEn: "article file", optional: true, variadic: true },
    ],
  },
  {
    command: "search",
    description: "按标题、拼音、首字母或标签搜索文章",
    descriptionEn: "Search titles, pinyin, initials, or tags",
    arguments: [
      {
        name: "query|--tag tag",
        description: "搜索内容或标签过滤器",
        descriptionEn: "search query or tag filter",
        optional: true,
        variadic: true,
      },
    ],
  },
  {
    command: "stat",
    description: "查看文章的完整元数据",
    descriptionEn: "Display complete article metadata",
    arguments: [{ name: "article", description: "文章文件", descriptionEn: "article file", variadic: true }],
  },
  { command: "pwd", description: "显示当前路径", descriptionEn: "Print the active archive path" },
  { command: "whoami", description: "显示当前账户", descriptionEn: "Print the current account" },
  { command: "date", description: "显示当前日期和时间", descriptionEn: "Print the current date and time" },
  {
    command: "help",
    aliases: ["man"],
    description: "查看完整命令手册",
    descriptionEn: "Open the complete command reference",
  },
  {
    command: "history",
    description: "显示命令历史",
    descriptionEn: "Print command history",
  },
  {
    command: "clear",
    description: "清空屏幕并创建新会话",
    descriptionEn: "Clear the screen and begin a fresh session",
  },
  {
    command: "theme",
    description: "切换颜色模式；默认跟随系统",
    descriptionEn: "Switch color mode; defaults to the system setting",
    arguments: [
      {
        name: "mode",
        description: "颜色模式",
        descriptionEn: "color mode",
        optional: true,
        choices: ["auto", "light", "dark"],
      },
    ],
  },
  {
    command: "lang",
    description: "切换界面语言，不改变命令名称",
    descriptionEn: "Switch UI language without translating commands",
    arguments: [
      {
        name: "language",
        description: "界面语言",
        descriptionEn: "interface language",
        optional: true,
        choices: ["zh", "en"],
      },
    ],
  },
  {
    command: "drawer",
    aliases: ["tree"],
    description: "打开或折叠辅助文件树",
    descriptionEn: "Open or collapse the helper file tree",
  },
  { command: "screenfetch", description: "查看这台终端的信息", descriptionEn: "Inspect this terminal node" },
  {
    command: "cmatrix",
    aliases: ["matrix"],
    description: "启动字符雨",
    descriptionEn: "Start a phosphor character stream",
  },
  { command: "hollywood", description: "启动电影模式", descriptionEn: "Start cinematic operations mode" },
  { command: "cbonsai", description: "种一棵字符树", descriptionEn: "Grow a procedural text tree" },
  {
    command: "cowsay",
    description: "让终端替你发言",
    descriptionEn: "Ask the terminal to speak",
    arguments: [{ name: "message", description: "消息", descriptionEn: "message", optional: true, variadic: true }],
  },
  { command: "nyancat", description: "呼叫彩虹信号", descriptionEn: "Call the rainbow uplink" },
  {
    command: "su",
    description: "切换管理员账户",
    descriptionEn: "Switch to the administrator account",
    arguments: [
      {
        name: "user",
        description: "目标账户",
        descriptionEn: "target account",
        optional: true,
        choices: ["root"],
      },
    ],
  },
  {
    command: "exit",
    aliases: ["logout"],
    description: "退出当前特权账户",
    descriptionEn: "Leave the current privileged account",
  },
  {
    command: "passwd",
    description: "修改 root 密码",
    descriptionEn: "Change the root password",
    rootOnly: true,
  },
  {
    command: "email",
    description: "查看或修改联系邮箱",
    descriptionEn: "Read or change the contact email",
    arguments: [{ name: "address", description: "邮箱地址", descriptionEn: "email address", optional: true }],
    rootOnly: true,
  },
  {
    command: "nano",
    description: "在终端中创建或编辑文章",
    descriptionEn: "Create or edit an article inside the terminal",
    arguments: [{ name: "article|./system/config", description: "文件", descriptionEn: "file", optional: true }],
    rootOnly: true,
  },
  {
    command: "draft",
    description: "新建、列出、编辑、发布或删除草稿",
    descriptionEn: "Create, list, edit, publish, or remove drafts",
    arguments: [
      {
        name: "action",
        description: "草稿操作",
        descriptionEn: "draft action",
        choices: ["new", "list", "edit", "publish", "rm"],
      },
      { name: "id", description: "草稿 ID", descriptionEn: "draft id", optional: true },
    ],
    rootOnly: true,
  },
  {
    command: "sudo",
    description: "验证 root 密码并以管理员权限执行一条命令",
    descriptionEn: "Authenticate and execute one command with root privileges",
    arguments: [
      { name: "command", description: "需要提权的命令", descriptionEn: "command to elevate", variadic: true },
    ],
  },
  {
    command: "mv",
    description: "移动文章",
    descriptionEn: "Move an article to another category",
    arguments: [
      { name: "article", description: "文章", descriptionEn: "article" },
      { name: "category", description: "目标分类", descriptionEn: "target category" },
    ],
    rootOnly: true,
  },
  {
    command: "mkdir",
    description: "在 articles 下创建一级文章分类",
    descriptionEn: "Create a top-level article category under articles",
    arguments: [{ name: "category", description: "分类名称", descriptionEn: "category name", variadic: true }],
    rootOnly: true,
  },
  {
    command: "upload",
    description: "上传拖入终端的文件到 articles 或 access 白名单路径",
    descriptionEn: "Upload a terminal drop to a whitelisted articles or access path",
    arguments: [
      {
        name: "file",
        description: "拖入终端后生成的 remote 文件",
        descriptionEn: "remote file created by a terminal drop",
      },
      {
        name: "target_path",
        description: "articles/<分类> 或 access/<路径>",
        descriptionEn: "articles/<category> or access/<path>",
      },
    ],
    rootOnly: true,
  },
  {
    command: "rm",
    description: "删除文章",
    descriptionEn: "Remove an article",
    arguments: [{ name: "article", description: "文章", descriptionEn: "article", variadic: true }],
    rootOnly: true,
  },
  {
    command: "reset",
    description: "恢复示例文章",
    descriptionEn: "Restore the sample articles",
    rootOnly: true,
  },
] as const;

export type RegisteredCommand = (typeof commandRegistry)[number]["command"];

export const findCommand = (token: string) => {
  const normalized = token.toLowerCase();
  return commandRegistry.find(
    (definition) => definition.command === normalized || definition.aliases?.some((alias) => alias === normalized),
  );
};

export const validateCommandArguments = (definition: CommandDefinition, values: string[]) => {
  const argumentsList = definition.arguments || [];
  const required = argumentsList.filter((argument) => !argument.optional).length;
  const lastArgument = argumentsList.at(-1);
  if (values.length < required) return `usage: ${getCommandSyntax(definition)}`;
  if (!lastArgument?.variadic && values.length > argumentsList.length) return `usage: ${getCommandSyntax(definition)}`;
  return null;
};

export const commandReference = commandRegistry
  .filter((definition) => !definition.hidden)
  .map((definition) => ({
    ...definition,
    syntax: getCommandSyntax(definition),
    hint: definition.description,
    hintEn: definition.descriptionEn,
  }));
