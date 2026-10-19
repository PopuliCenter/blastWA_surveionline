import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { Button, theme } from "../../lib/ui";

const LABEL = { image: "gambar", sticker: "stiker" };

/**
 * Gambar/stiker dari responden. Diambil dari Meta HANYA saat tombolnya ditekan — tidak
 * dimuat otomatis dan tidak disimpan di server (lihat backend/src/lib/mediaPesan.ts).
 * Meta menyimpan media hanya sementara, jadi gambar lama bisa sudah tidak tersedia.
 */
export function MediaPesan({ pesanId, jenis }) {
  const [keadaan, setKeadaan] = useState({ status: "awal" });
  // Unduhan yang sedang berjalan dibatalkan saat gelembung hilang (pindah percakapan,
  // kembali di ponsel). Tanpa itu, hasilnya tetap dijadikan URL objek yang tak pernah
  // dilepas — gambar hingga 5 MB tertahan di memori selama kotak masuk terbuka.
  const unduhan = useRef(null);
  useEffect(() => () => unduhan.current?.abort(), []);

  // URL objek dilepas saat gelembung hilang atau gambarnya diganti.
  useEffect(() => {
    if (keadaan.status !== "tampil") return;
    return () => URL.revokeObjectURL(keadaan.url);
  }, [keadaan]);

  const buka = async () => {
    unduhan.current?.abort();
    const ac = new AbortController();
    unduhan.current = ac;
    setKeadaan({ status: "memuat" });
    try {
      const blob = await api.mediaPesan(pesanId, { signal: ac.signal });
      if (ac.signal.aborted) return;
      setKeadaan({ status: "tampil", url: URL.createObjectURL(blob) });
    } catch (e) {
      if (ac.signal.aborted) return;
      setKeadaan({ status: "galat", pesan: e.message || "Gagal memuat." });
    }
  };

  if (keadaan.status === "tampil")
    return (
      <a href={keadaan.url} target="_blank" rel="noopener noreferrer" title="Buka ukuran penuh">
        <img
          src={keadaan.url}
          alt={`${LABEL[jenis] ?? "media"} dari responden`}
          style={{
            display: "block",
            marginTop: 6,
            maxWidth: jenis === "sticker" ? 140 : "100%",
            width: jenis === "sticker" ? undefined : 240,
            maxHeight: 280,
            objectFit: "contain",
            borderRadius: 8,
            background: theme.surfaceAlt,
          }}
        />
      </a>
    );

  return (
    <div style={{ marginTop: 6 }}>
      <Button size="sm" variant="secondary" icon="eye" onClick={buka} disabled={keadaan.status === "memuat"}>
        {keadaan.status === "memuat" ? "Memuat..." : `Lihat ${LABEL[jenis] ?? "media"}`}
      </Button>
      {keadaan.status === "galat" ? (
        <div style={{ fontSize: 11.5, color: theme.red, marginTop: 6, lineHeight: 1.4 }}>{keadaan.pesan}</div>
      ) : null}
    </div>
  );
}
