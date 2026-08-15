"use client";

import { useEffect, useRef, useState } from "react";

type NanoEditorProps = {
  fileName: string;
  value: string;
  onChange: (value: string) => void;
  onSave: () => Promise<void> | void;
  onExit: () => void;
};

export default function NanoEditor({ fileName, value, onChange, onSave, onExit }: NanoEditorProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [yankBuffer, setYankBuffer] = useState("");
  const [status, setStatus] = useState("GNU nano compatible mode");

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const updateSelection = (nextValue: string, start: number, end = start) => {
    onChange(nextValue);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(start, end);
    });
  };

  const handleKeyDown = async (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const node = event.currentTarget;
    if (!event.ctrlKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    if (key === "o") {
      event.preventDefault();
      setStatus(`Writing ${fileName}...`);
      try {
        await onSave();
        setStatus(`Wrote ${fileName}`);
      } catch (error) {
        setStatus(`[ Error writing ${fileName}: ${error instanceof Error ? error.message : "unknown error"} ]`);
      }
      return;
    }
    if (key === "x") {
      event.preventDefault();
      onExit();
      return;
    }
    if (key === "g") {
      event.preventDefault();
      setStatus("^O Write Out  ^X Exit  ^W Where Is  ^K Cut  ^U Paste");
      return;
    }
    if (key === "w") {
      event.preventDefault();
      setStatus("Where Is: use the browser find bar or continue typing");
      return;
    }
    if (key === "k") {
      event.preventDefault();
      const lineStart = node.value.lastIndexOf("\n", node.selectionStart - 1) + 1;
      const newline = node.value.indexOf("\n", node.selectionStart);
      const lineEnd = newline === -1 ? node.value.length : newline + 1;
      setYankBuffer(node.value.slice(lineStart, lineEnd));
      updateSelection(`${node.value.slice(0, lineStart)}${node.value.slice(lineEnd)}`, lineStart);
      setStatus("Cut line");
      return;
    }
    if (key === "u") {
      event.preventDefault();
      if (!yankBuffer) return;
      const start = node.selectionStart;
      updateSelection(
        `${node.value.slice(0, start)}${yankBuffer}${node.value.slice(node.selectionEnd)}`,
        start + yankBuffer.length,
      );
      setStatus("Pasted line");
    }
  };

  return (
    <section className="nano-editor" aria-label={`nano ${fileName}`}>
      <header className="nano-titlebar">GNU nano 8.2 · {fileName}</header>
      <textarea
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        wrap="off"
        aria-label={fileName}
      />
      <div className="nano-status">{status}</div>
      <footer className="nano-shortcuts">^O Write Out · ^X Exit · ^W Where Is · ^K Cut · ^U Paste · ^G Help</footer>
    </section>
  );
}
