// Logika MURNI simulasi survei sisi klien (preview di editor).
// Mencerminkan backend `surveyLogic.ts` — TERUTAMA skip-logic (nextStep) agar preview
// tidak lagi menyimpang dari perilaku sebenarnya. Backend tetap otoritas final;
// idealnya keduanya berbagi satu paket, sementara ini disatukan & diuji di sini.

// Teks pertanyaan + petunjuk tipe (gaya WhatsApp markdown).
export function formatQuestion(q, idx, total) {
  const min = q.options?.min ?? 1;
  const max = q.options?.max ?? 10;
  const choices = q.options?.choices || [];
  let text = `*Pertanyaan ${idx + 1} dari ${total}*\n${q.text}`;
  if (q.type === "rating") {
    text += `\n\n_Balas dengan angka ${min}–${max}_`;
    const mn = (q.options?.minLabel || "").trim();
    const mx = (q.options?.maxLabel || "").trim();
    if (mn || mx) text += ` _(${min} = ${mn || "…"}, ${max} = ${mx || "…"})_`;
  } else if (q.type === "choice")
    text += "\n\n" + choices.map((c, i) => `${i + 1}. ${c}`).join("\n") + "\n\n_Balas nomor atau teks pilihan_";
  else if (q.type === "multichoice")
    text +=
      "\n\n" +
      choices.map((c, i) => `${i + 1}. ${c}`).join("\n") +
      "\n\n_Boleh >1 — balas nomornya dipisah koma (mis. 1,3)_";
  else if (q.type === "boolean") text += "\n\n_Balas: Ya / Tidak_";
  else if (q.type === "consent") text += "\n\n_Balas: Ya (setuju) / Tidak_";
  else if (q.type === "date") text += "\n\n_Balas tanggal, format DD-MM-YYYY (mis. 17-08-2026)_";
  else if (q.type === "number") text += "\n\n_Balas dengan angka_";
  else if (q.type === "image") text += "\n\n_Kirim foto sebagai simulasi (ketik nama file)_";
  if (!q.required) text += "\n\n_Opsional — ketik *lewati* untuk melewati_";
  return text;
}

// Validasi & normalisasi jawaban per tipe. { ok: true, saved } | { ok: false, err }
export function validateAnswer(q, answer) {
  const a = answer.trim();
  if (!q.required && /^(lewati|skip|lewat|-)$/i.test(a)) return { ok: true, saved: "[dilewati]" };
  switch (q.type) {
    case "text":
      if (!a) return { ok: false, err: "Jawaban tidak boleh kosong." };
      return { ok: true, saved: a };
    case "number": {
      const n = parseFloat(a);
      if (isNaN(n)) return { ok: false, err: "Masukkan angka yang valid." };
      return { ok: true, saved: String(n) };
    }
    case "rating": {
      const n = parseInt(a);
      const min = q.options?.min ?? 1;
      const max = q.options?.max ?? 10;
      if (isNaN(n) || n < min || n > max) return { ok: false, err: `Masukkan angka ${min}–${max}.` };
      return { ok: true, saved: String(n) };
    }
    case "choice": {
      const choices = q.options?.choices || [];
      const idx = parseInt(a) - 1;
      if (!isNaN(idx) && idx >= 0 && idx < choices.length) return { ok: true, saved: choices[idx] };
      const match = choices.find((c) => c.toLowerCase() === a.toLowerCase());
      if (match) return { ok: true, saved: match };
      return { ok: false, err: `Pilih: ${choices.map((c, i) => `${i + 1}. ${c}`).join(" | ")}` };
    }
    case "multichoice": {
      const choices = q.options?.choices || [];
      const tokens = a
        .split(/[,;\s]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      if (!tokens.length) return { ok: false, err: "Balas nomor pilihan, boleh >1 dipisah koma (mis. 1,3)." };
      if (!choices.length) return { ok: true, saved: tokens.join(", ") };
      const picked = [];
      for (const tok of tokens) {
        const n = parseInt(tok) - 1;
        if (!isNaN(n) && n >= 0 && n < choices.length) {
          if (!picked.includes(choices[n])) picked.push(choices[n]);
          continue;
        }
        const match = choices.find((c) => c.toLowerCase() === tok.toLowerCase());
        if (match) {
          if (!picked.includes(match)) picked.push(match);
          continue;
        }
        return { ok: false, err: `Pilihan "${tok}" tak dikenali. Balas nomornya, pisah koma (mis. 1,3).` };
      }
      return { ok: true, saved: picked.join(", ") };
    }
    case "consent":
    case "boolean": {
      if (/^(ya|yes|y|1|iya|setuju)$/i.test(a)) return { ok: true, saved: "Ya" };
      if (/^(tidak|no|n|0|tdk|tdak)$/i.test(a)) return { ok: true, saved: "Tidak" };
      return { ok: false, err: 'Balas dengan "Ya" atau "Tidak".' };
    }
    case "date": {
      // Terima DD-MM-YYYY / DD/MM/YYYY / YYYY-MM-DD → simpan seragam YYYY-MM-DD.
      const iso = a.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      const dmy = a.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
      const p = iso
        ? [+iso[1], +iso[2], +iso[3]]
        : dmy
          ? [+dmy[3], +dmy[2], +dmy[1]]
          : null;
      if (p) {
        const dt = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
        if (dt.getUTCFullYear() === p[0] && dt.getUTCMonth() === p[1] - 1 && dt.getUTCDate() === p[2])
          return { ok: true, saved: dt.toISOString().slice(0, 10) };
      }
      return { ok: false, err: "Format tanggal salah. Contoh: 17-08-2026." };
    }
    case "image":
      if (!a) return { ok: false, err: "Ketik nama file gambar sebagai simulasi." };
      return { ok: true, saved: `[gambar] ${a}` };
    default:
      if (!a) return { ok: false, err: "Jawaban tidak boleh kosong." };
      return { ok: true, saved: a };
  }
}

// Langkah berikutnya dengan skip-logic (options.branches). Cermin backend nextStepWithBranch.
// Mengembalikan indeks pertanyaan berikutnya; >= total berarti survei selesai.
export function nextStep(q, step, savedValue, total) {
  const def = step + 1;
  const branches = q.options?.branches;
  if (!Array.isArray(branches) || !savedValue || savedValue === "[dilewati]") return def;
  const sv = String(savedValue).trim().toLowerCase();
  const m = branches.find(
    (b) =>
      String(b.value ?? "")
        .trim()
        .toLowerCase() === sv,
  );
  if (!m) return def;
  if (m.goto === "end" || m.goto === -1) return total; // akhiri lebih awal
  const g = Number(m.goto);
  if (Number.isInteger(g) && g > step && g < total) return g; // lompat MAJU
  return def;
}

export function quickReplies(q) {
  if (!q) return [];
  if (q.type === "boolean" || q.type === "consent") return ["Ya", "Tidak"];
  if (q.type === "choice") return (q.options?.choices || []).map((_, i) => String(i + 1));
  return [];
}

export function inputPlaceholder(q) {
  if (!q) return "";
  if (q.type === "rating") {
    const min = q.options?.min ?? 1;
    const max = q.options?.max ?? 10;
    return `Angka ${min}–${max}…`;
  }
  if (q.type === "number") return "Ketik angka…";
  if (q.type === "boolean" || q.type === "consent") return "Ya / Tidak…";
  if (q.type === "date") return "DD-MM-YYYY, mis. 17-08-2026…";
  if (q.type === "choice") return "Nomor atau teks pilihan…";
  if (q.type === "multichoice") return "Nomor pilihan, mis. 1,3…";
  if (q.type === "image") return "Nama file gambar (simulasi)…";
  if (!q.required) return "Jawaban atau ketik lewati…";
  return "Ketik jawaban…";
}
