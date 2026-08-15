type TerminalContextMenuProps = {
  x: number;
  y: number;
  onCopy: () => void;
  onPaste: () => void;
  onPasteSelection: () => void;
  onSelectAll: () => void;
  onClear: () => void;
};

export default function TerminalContextMenu({
  x,
  y,
  onCopy,
  onPaste,
  onPasteSelection,
  onSelectAll,
  onClear,
}: TerminalContextMenuProps) {
  return (
    <div
      className="terminal-context-menu"
      style={{ left: x, top: y }}
      role="menu"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button type="button" onClick={onCopy}>
        复制
      </button>
      <button type="button" onClick={onPaste}>
        粘贴
      </button>
      <button type="button" onClick={onPasteSelection}>
        粘贴选择区
      </button>
      <button type="button" onClick={onSelectAll}>
        全选
      </button>
      <button type="button" onClick={onClear}>
        清除
      </button>
    </div>
  );
}
