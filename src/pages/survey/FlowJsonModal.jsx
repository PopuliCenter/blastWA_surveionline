import { useCallback, useState } from "react";
import { api } from "../../lib/api";
import { Button, Modal, Notice, Loading, useLoader, theme } from "../../lib/ui";

export function FlowJsonModal({ surveyId, onClose }) {
  const { data, loading, error } = useLoader(useCallback(() => api.surveyFlowJson(surveyId), [surveyId]));
  const [copied, setCopied] = useState(false);
  const json = data ? JSON.stringify(data, null, 2) : "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  const download = () => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "survey-flow.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Modal title="Flow JSON untuk Meta" onClose={onClose} width={640}>
      <Notice>{error}</Notice>
      <div style={{ fontSize: 12.5, color: theme.textMuted, marginBottom: 12, lineHeight: 1.6 }}>
        Salin JSON ini → buka <strong>Meta WhatsApp Manager › Flows › Create Flow › Editor (JSON)</strong> → tempel →{" "}
        <strong>Publish</strong> → salin <strong>Flow ID</strong> kembali ke kolom di editor survei.
      </div>
      {loading ? (
        <Loading />
      ) : (
        <>
          <textarea
            readOnly
            value={json}
            style={{
              width: "100%",
              height: 280,
              fontFamily: "monospace",
              fontSize: 11.5,
              padding: 12,
              border: `1px solid ${theme.border}`,
              borderRadius: 9,
              boxSizing: "border-box",
              outline: "none",
              background: theme.surfaceAlt,
              color: theme.text,
              resize: "vertical",
            }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <Button variant="secondary" icon={copied ? "check" : "download"} onClick={copy}>
              {copied ? "Disalin" : "Salin JSON"}
            </Button>
            <Button variant="secondary" icon="download" onClick={download}>
              Unduh .json
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Tutup
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
