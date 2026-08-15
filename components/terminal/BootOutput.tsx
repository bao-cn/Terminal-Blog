type BootOutputProps = { language: "zh" | "en"; sourceAddress: string };

export default function BootOutput({ language, sourceAddress }: BootOutputProps) {
  return (
    <div className="boot-output">
      <div className="copyright-block">
        <span>Terminal Blog Shell 2.6.0 (tty/07)</span>
        <span>Copyright (c) 2026 Terminal Blog. All signals preserved.</span>
        <span>
          {language === "en"
            ? `Last login: Fri Aug 15 04:42:07 from ${sourceAddress}`
            : `上次登录：2026年8月15日 04:42:07，来源：${sourceAddress}`}
        </span>
      </div>
    </div>
  );
}
