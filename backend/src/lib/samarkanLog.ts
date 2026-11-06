// Parameter URL yang berisi rahasia, disamarkan sebelum URL permintaan dicatat.
//
// Log akses Fastify mencatat URL lengkap. Verifikasi webhook Meta membawa Verify Token di
// query string (hub.verify_token — Fastify juga menerima bentuk hub_verify_token), dan
// beberapa panggilan bisa membawa access_token. Log disalin ke tempat lain saat menelusuri
// masalah; rahasianya tidak boleh ikut.
//
// Nama parameter dicocokkan SETELAH di-decode, sama seperti parser query Fastify: tanpa itu
// "hub%2Everify_token=…" tetap terbaca server sebagai Verify Token, tetapi lolos dari
// penyamaran dan tercatat utuh.
const KUNCI_RAHASIA = new Set(["hub.verify_token", "hub_verify_token", "access_token", "token"]);

function kunciAsli(mentah: string): string {
  try {
    return decodeURIComponent(mentah.replace(/\+/g, " ")).toLowerCase();
  } catch {
    return mentah.toLowerCase();
  }
}

export function samarkanUrl(url: string | undefined): string {
  const s = String(url ?? "");
  const tanya = s.indexOf("?");
  if (tanya < 0) return s;
  const pagar = s.indexOf("#", tanya);
  const query = s.slice(tanya + 1, pagar < 0 ? undefined : pagar);
  const sisa = pagar < 0 ? "" : s.slice(pagar);
  const bagian = query.split("&").map((p) => {
    const sama = p.indexOf("=");
    const kunci = sama < 0 ? p : p.slice(0, sama);
    return KUNCI_RAHASIA.has(kunciAsli(kunci)) ? `${kunci}=***` : p;
  });
  return `${s.slice(0, tanya + 1)}${bagian.join("&")}${sisa}`;
}

// Serializer permintaan untuk logger Fastify: sama dengan bawaannya, kecuali URL disamarkan.
export function serializerReq(req: {
  method: string;
  url: string;
  host?: string;
  ip?: string;
  socket?: { remotePort?: number };
}) {
  return {
    method: req.method,
    url: samarkanUrl(req.url),
    host: req.host,
    remoteAddress: req.ip,
    remotePort: req.socket?.remotePort,
  };
}

type AppDenganLog = {
  setNotFoundHandler: (
    h: (
      req: { method: string; url: string; log: { info: (m: string) => void } },
      reply: { code: (n: number) => { send: (b: unknown) => unknown } },
    ) => unknown,
  ) => unknown;
};

// Pengganti 404 bawaan Fastify, yang mencatat dan membalas URL mentah ("Route GET:… not
// found") tanpa melewati serializer di atas. Callback URL yang salah ketik di dasbor Meta
// (mis. garis miring di akhir) akan membuat Verify Token tercatat utuh di sana.
export function pasangPenangan404(app: AppDenganLog): void {
  app.setNotFoundHandler((req, reply) => {
    const pesan = `Route ${req.method}:${samarkanUrl(req.url)} not found`;
    req.log.info(pesan);
    return reply.code(404).send({ message: pesan, error: "Not Found", statusCode: 404 });
  });
}
