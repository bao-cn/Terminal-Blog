"use client";

import { useEffect, useRef, useState } from "react";

type LessViewerProps = {
  fileName: string;
  value: string;
  onExit: () => void;
};

export default function LessViewer({ fileName, value, onExit }: LessViewerProps) {
  const viewerRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ page: 1, atEnd: false });

  useEffect(() => {
    viewerRef.current?.focus();
  }, []);

  const updatePosition = () => {
    const node = contentRef.current;
    if (!node) return;
    setPosition({
      page: Math.floor(node.scrollTop / Math.max(node.clientHeight, 1)) + 1,
      atEnd: node.scrollTop + node.clientHeight >= node.scrollHeight - 1,
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    const content = contentRef.current;
    if (event.key.toLowerCase() === "q") {
      event.preventDefault();
      onExit();
      return;
    }
    if (!content) return;
    const lineHeight = Number.parseFloat(window.getComputedStyle(content).lineHeight) || 22;
    if (event.key === "ArrowDown" || event.key === "j") {
      event.preventDefault();
      content.scrollBy({ top: lineHeight });
    } else if (event.key === "ArrowUp" || event.key === "k") {
      event.preventDefault();
      content.scrollBy({ top: -lineHeight });
    } else if (event.key === "PageDown" || event.key === " ") {
      event.preventDefault();
      content.scrollBy({ top: content.clientHeight });
    } else if (event.key === "PageUp" || event.key === "b") {
      event.preventDefault();
      content.scrollBy({ top: -content.clientHeight });
    } else if (event.key === "Home" || event.key === "g") {
      event.preventDefault();
      content.scrollTo({ top: 0 });
    } else if (event.key === "End" || event.key === "G") {
      event.preventDefault();
      content.scrollTo({ top: content.scrollHeight });
    }
    window.requestAnimationFrame(updatePosition);
  };

  return (
    <section
      ref={viewerRef}
      className="less-viewer"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={`less ${fileName}`}
    >
      <div ref={contentRef} className="less-content" onScroll={updatePosition}>
        <pre>{value}</pre>
      </div>
      <footer>
        {fileName} {position.atEnd ? "(END)" : `page ${position.page}`} · q quit
      </footer>
    </section>
  );
}
