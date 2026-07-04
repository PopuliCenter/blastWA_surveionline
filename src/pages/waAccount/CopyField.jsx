import { useState } from "react";
import { Button, theme } from "../../lib/ui";

// Field read-only dengan tombol salin
export function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, color: theme.text, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          readOnly
          value={value}
          onFocus={(e) => e.target.select()}
          style={{
            flex: 1,
            padding: "10px 12px",
            background: theme.surfaceAlt,
            color: theme.text,
            border: `1px solid ${theme.border}`,
            borderRadius: 9,
            fontSize: 12.5,
            fontFamily: "monospace",
            boxSizing: "border-box",
            outline: "none",
          }}
        />
        <Button variant="secondary" size="sm" icon={copied ? "check" : "download"} onClick={copy}>
          {copied ? "Disalin" : "Salin"}
        </Button>
      </div>
    </div>
  );
}
