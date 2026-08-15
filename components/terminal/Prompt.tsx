type PromptProps = { user: string; path: string };

export default function Prompt({ user, path }: PromptProps) {
  const identityClass = user === "root" ? "text-root" : "text-cyan";
  return (
    <span className="prompt-mark">
      <span className={identityClass}>{user}</span>
      <span className={identityClass}>@terminal.blog:</span>
      <span className="text-blue">{path}</span>
      <span className={user === "root" ? "text-root" : "text-green"}>$</span>
    </span>
  );
}
