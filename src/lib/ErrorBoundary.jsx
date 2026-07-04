import { Component } from "react";

// Menangkap error render (termasuk lazy-chunk yang gagal dimuat setelah deploy) agar
// aplikasi tidak white-screen. Untuk error "chunk gagal dimuat", muat ulang otomatis
// SEKALI (hash file berubah tiap deploy → reload mengambil index.html + chunk terbaru).
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) {
    return { err };
  }
  componentDidCatch(err) {
    const msg = String(err?.message || err);
    const isChunk = /dynamically imported module|Loading chunk|Failed to fetch|import\(\)/i.test(msg);
    if (isChunk && !sessionStorage.getItem("chunkReloaded")) {
      sessionStorage.setItem("chunkReloaded", "1"); // cegah loop reload
      window.location.reload();
    }
  }
  componentDidMount() {
    // App termuat baik → reset penanda agar reload-otomatis bisa dipakai lagi nanti.
    setTimeout(() => sessionStorage.removeItem("chunkReloaded"), 3000);
  }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          padding: 24,
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#334155",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 40 }}>⚠️</div>
        <div style={{ fontWeight: 700, fontSize: 18 }}>Terjadi kesalahan</div>
        <div style={{ fontSize: 14, color: "#64748b", maxWidth: 380, lineHeight: 1.6 }}>
          Aplikasi mengalami gangguan sesaat. Coba muat ulang halaman. Bila berlanjut, hubungi admin.
        </div>
        <button
          onClick={() => {
            sessionStorage.removeItem("chunkReloaded");
            window.location.reload();
          }}
          style={{
            padding: "10px 20px",
            borderRadius: 9,
            border: "none",
            background: "#ea580c",
            color: "#fff",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Muat Ulang
        </button>
      </div>
    );
  }
}
