// Render teks dengan markdown WA: *bold* _italic_
export function WaText({ text }) {
  const lines = text.split("\n");
  return (
    <span>
      {lines.map((line, li) => {
        const parts = line.split(/(\*[^*]+\*|_[^_]+_)/);
        return (
          <span key={li}>
            {li > 0 && <br />}
            {parts.map((p, pi) => {
              if (p.startsWith("*") && p.endsWith("*")) return <strong key={pi}>{p.slice(1, -1)}</strong>;
              if (p.startsWith("_") && p.endsWith("_"))
                return (
                  <em key={pi} style={{ color: "#666", fontSize: "0.93em" }}>
                    {p.slice(1, -1)}
                  </em>
                );
              return p;
            })}
          </span>
        );
      })}
    </span>
  );
}
