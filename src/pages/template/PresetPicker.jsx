import { Modal, Icon, theme } from "../../lib/ui";
import { PRESETS } from "./constants";

export function PresetPicker({ onClose, onPick }) {
  return (
    <Modal title="Pilih Contoh Template" onClose={onClose} width={560}>
      <p style={{ marginTop: 0, color: theme.textMuted, fontSize: 13 }}>
        Pilih sesuai kebutuhan. Isinya bisa Anda edit sebelum disimpan.
      </p>
      <div style={{ display: "grid", gap: 10 }}>
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => onPick(p.data)}
            style={{
              display: "flex",
              gap: 13,
              alignItems: "center",
              textAlign: "left",
              padding: 14,
              border: `1px solid ${theme.border}`,
              borderRadius: 11,
              background: theme.surface,
              cursor: "pointer",
            }}
          >
            <span
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: theme.primarySoft,
                color: theme.primary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon name={p.icon} size={20} />
            </span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontWeight: 700, color: theme.text, fontSize: 14 }}>{p.title}</span>
              <span style={{ display: "block", color: theme.textMuted, fontSize: 12.5, marginTop: 2 }}>{p.desc}</span>
            </span>
            <Icon name="back" size={18} style={{ transform: "rotate(180deg)" }} />
          </button>
        ))}
      </div>
    </Modal>
  );
}
