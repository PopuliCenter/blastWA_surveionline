import { describe, it, expect } from "vitest";
import {
  bulatkanKoordinat,
  koordinatDari,
  koordinatDariObjek,
  saringLokasi,
  statusLokasi,
  kolomLokasiSheet,
  LABEL_STATUS_LOKASI,
} from "../src/lib/lokasi.js";
import { MetaCloudAdapter } from "../src/providers/meta.js";
import { QontakAdapter } from "../src/providers/qontak.js";

// Titik GPS mentah tidak boleh tersimpan di mana pun: kolom respons hanya menerima titik
// yang dibulatkan, dan log webhook serta riwayat pesan disaring dengan aturan yang sama.

describe("koordinatDari", () => {
  it("menerima angka maupun teks angka", () => {
    expect(koordinatDari(-6.9147, 107.6098)).toEqual({ lat: -6.9147, lng: 107.6098 });
    expect(koordinatDari("-6.9147", "107.6098")).toEqual({ lat: -6.9147, lng: 107.6098 });
  });

  it("menolak yang bukan koordinat bumi", () => {
    expect(koordinatDari(91, 100)).toBeNull();
    expect(koordinatDari(-6, 181)).toBeNull();
    expect(koordinatDari("abc", 100)).toBeNull();
    expect(koordinatDari(undefined, undefined)).toBeNull();
  });

  it("(0, 0) dianggap 'tidak ada lokasi', bukan titik di Teluk Guinea", () => {
    expect(koordinatDari(0, 0)).toBeNull();
    expect(koordinatDari(0, 107)).toEqual({ lat: 0, lng: 107 });
  });
});

describe("bulatkanKoordinat", () => {
  it("dua desimal — sekitar 1 km", () => {
    expect(bulatkanKoordinat({ lat: -6.914744, lng: 107.60981 })).toEqual({ lat: -6.91, lng: 107.61 });
  });
});

describe("saringLokasi", () => {
  it("payload webhook Meta: koordinat dibulatkan, nama tempat & alamat dibuang, sisanya utuh", () => {
    const asli = {
      entry: [
        {
          changes: [
            {
              value: {
                contacts: [{ wa_id: "628111", profile: { name: "Budi" } }],
                messages: [
                  {
                    from: "628111",
                    type: "location",
                    location: {
                      latitude: -6.914744,
                      longitude: 107.60981,
                      name: "Rumah Budi",
                      address: "Jl. Contoh No. 1",
                      url: "https://contoh",
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const s = saringLokasi(asli);
    const v = s.entry[0]!.changes[0]!.value;
    expect(v.messages[0]!.location).toEqual({ latitude: -6.91, longitude: 107.61 });
    // "name" di luar objek lokasi tidak boleh ikut terhapus.
    expect(v.contacts[0]!.profile.name).toBe("Budi");
    expect(v.messages[0]!.from).toBe("628111");
    // Yang asli tidak diubah.
    expect(asli.entry[0]!.changes[0]!.value.messages[0]!.location.latitude).toBe(-6.914744);
  });

  it("pesan Baileys: degreesLatitude/degreesLongitude, termasuk gambar pratinjau peta", () => {
    const s = saringLokasi({
      message: {
        locationMessage: {
          degreesLatitude: -6.914744,
          degreesLongitude: 107.60981,
          name: "Kantor",
          address: "Bandung",
          jpegThumbnail: "AAAA",
        },
      },
    });
    expect(s.message.locationMessage).toEqual({ degreesLatitude: -6.91, degreesLongitude: 107.61 });
  });

  it("objek ber-toJSON (protobuf Baileys, Buffer) diubah seperti Prisma, bukan ditelusuri per byte", () => {
    const bytes = Uint8Array.from([1, 2, 3]);
    const proto = { toJSON: () => ({ text: "halo", mediaKey: "AQID" }) };
    const s = saringLokasi({ message: proto, buf: Buffer.from([1, 2]), mentah: bytes });
    expect(s.message).toEqual({ text: "halo", mediaKey: "AQID" });
    expect(s.buf).toEqual({ type: "Buffer", data: [1, 2] });
    expect(s.mentah).toBe(bytes);
  });

  it("setiap ejaan kolom koordinat yang dikenali pembaca juga disaring", () => {
    for (const [kLat, kLng] of [
      ["lat", "lng"],
      ["lat", "long"],
      ["latitude", "lng"],
      ["lat", "longitude"],
    ]) {
      const o = { [kLat]: -6.914744, [kLng]: 107.60981, name: "Rumah", address: "Jl. X" };
      expect(koordinatDariObjek(o)).toEqual({ lat: -6.914744, lng: 107.60981 });
      expect(saringLokasi(o)).toEqual({ [kLat]: -6.91, [kLng]: 107.61 });
    }
  });

  it("payload tanpa lokasi tidak berubah", () => {
    const p = { a: [1, "x", null, { name: "tetap", b: true }] };
    expect(saringLokasi(p)).toEqual(p);
  });
});

describe("statusLokasi", () => {
  const dasar = { lokasiDimintaPada: null, lokasiDiterimaPada: null, kodeProvinsiLokasi: null, kodeProvinsi: null };
  const t = new Date();

  it("membedakan setiap keadaan", () => {
    expect(statusLokasi(dasar)).toBe("tidak-diminta");
    expect(statusLokasi({ ...dasar, lokasiDimintaPada: t })).toBe("belum-dibagikan");
    expect(statusLokasi({ ...dasar, lokasiDimintaPada: t, lokasiDiterimaPada: t })).toBe("di-luar-batas");
    expect(statusLokasi({ ...dasar, lokasiDimintaPada: t, lokasiDiterimaPada: t, kodeProvinsiLokasi: "32" })).toBe(
      "tanpa-pembanding",
    );
    expect(
      statusLokasi({ lokasiDimintaPada: t, lokasiDiterimaPada: t, kodeProvinsiLokasi: "32", kodeProvinsi: "32" }),
    ).toBe("sesuai");
    expect(
      statusLokasi({ lokasiDimintaPada: t, lokasiDiterimaPada: t, kodeProvinsiLokasi: "31", kodeProvinsi: "32" }),
    ).toBe("tidak-sesuai");
  });

  it("data batas belum terpasang → 'belum diperiksa', bukan 'di luar batas'", () => {
    const r = { lokasiDimintaPada: t, lokasiDiterimaPada: t, kodeProvinsiLokasi: null, kodeProvinsi: "32" };
    expect(statusLokasi(r, false)).toBe("belum-diperiksa");
    expect(statusLokasi(r, true)).toBe("di-luar-batas");
  });

  it("setiap status punya label", () => {
    for (const s of [
      "belum-dibagikan",
      "belum-diperiksa",
      "di-luar-batas",
      "sesuai",
      "tidak-sesuai",
      "tanpa-pembanding",
    ] as const)
      expect(LABEL_STATUS_LOKASI[s]).toBeTruthy();
  });
});

describe("parseInbound Meta — pesan lokasi", () => {
  const adapter = new MetaCloudAdapter({ accessToken: "T", phoneNumberId: "P", graphVersion: "v21.0" });
  const webhook = (value: unknown) => ({
    rawBody: "",
    body: { entry: [{ changes: [{ value }] }] },
    headers: {},
    query: {},
  });

  it("meneruskan koordinat (titik asli — pembulatan terjadi saat disimpan)", () => {
    const out = adapter.parseInbound(
      webhook({
        messages: [
          {
            from: "628111",
            id: "wamid.loc",
            timestamp: "1753900000",
            type: "location",
            location: { latitude: -6.914744, longitude: 107.60981 },
          },
        ],
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.location).toEqual({ latitude: -6.914744, longitude: 107.60981 });
    expect(out[0]?.text).toBeUndefined();
    expect(out[0]?.contextId).toBeUndefined();
  });

  it("lokasi lewat tombol membawa ID pesan permintaannya (context.id)", () => {
    const out = adapter.parseInbound(
      webhook({
        messages: [
          {
            from: "628111",
            id: "wamid.loc2",
            timestamp: "1753900000",
            type: "location",
            context: { from: "62800", id: "wamid.minta" },
            location: { latitude: -6.9, longitude: 107.6 },
          },
        ],
      }),
    );
    expect(out[0]?.contextId).toBe("wamid.minta");
  });

  it("lokasi tanpa koordinat yang sah tidak menjadi event lokasi", () => {
    const out = adapter.parseInbound(
      webhook({
        messages: [{ from: "628111", id: "wamid.x", timestamp: "1753900000", type: "location", location: {} }],
      }),
    );
    expect(out.every((e) => !e.location)).toBe(true);
  });
});

describe("parseInbound Qontak — pesan lokasi", () => {
  const adapter = new QontakAdapter({ apiToken: "T", channelIntegrationId: "C" } as never);
  const webhook = (body: unknown) => ({ rawBody: "", body, headers: {}, query: {} });

  it("lokasi dikenali, bukan pesan kosong yang memulai survei", () => {
    const out = adapter.parseInbound(
      webhook({
        type: "location",
        room: { account_uniq_id: "628111" },
        location: { latitude: -6.9, longitude: 107.6 },
        id: "q1",
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.location).toEqual({ latitude: -6.9, longitude: 107.6 });
    expect(out[0]?.text).toBeUndefined();
  });

  it("bentuk {lat, long} diterima — dan payload yang disimpan tetap tersaring", () => {
    const body = {
      data: {
        id: "m1",
        type: "location",
        room: { account_uniq_id: "628111" },
        location: { lat: -6.914744, long: 107.60981, name: "Rumah Pak X", address: "Jl. Rahasia 1" },
      },
    };
    const out = adapter.parseInbound(webhook(body));
    expect(out[0]?.location).toEqual({ latitude: -6.914744, longitude: 107.60981 });
    expect(JSON.stringify(saringLokasi(out[0]?.raw))).not.toMatch(/914744|60981|Rumah|Rahasia/);
    expect(JSON.stringify(saringLokasi(body))).not.toMatch(/914744|60981|Rumah|Rahasia/);
  });

  it("lokasi yang koordinatnya tak terbaca dilewati, tidak diteruskan kosong", () => {
    const out = adapter.parseInbound(webhook({ type: "location", room: { account_uniq_id: "628111" } }));
    expect(out).toHaveLength(0);
  });
});

describe("kolomLokasiSheet — sama dengan ekspor Excel", () => {
  const t = new Date("2026-10-01T03:00:00Z");
  const r = (lain: Partial<Parameters<typeof kolomLokasiSheet>[0]>) => ({
    lokasiDimintaPada: t,
    lokasiDiterimaPada: null,
    lokasiLat: null,
    lokasiLng: null,
    kodeProvinsiLokasi: null,
    kodeProvinsi: "31",
    ...lain,
  });

  it("dibagikan: nama provinsi titiknya + status pemeriksaan", () => {
    const dibagikan = { lokasiDiterimaPada: t, lokasiLat: -6.2, lokasiLng: 106.85 };
    expect(kolomLokasiSheet(r({ ...dibagikan, kodeProvinsiLokasi: "31" }))).toEqual(["DKI Jakarta", "Sesuai"]);
    expect(kolomLokasiSheet(r({ ...dibagikan, kodeProvinsiLokasi: "32" }))).toEqual(["Jawa Barat", "Beda provinsi"]);
    expect(kolomLokasiSheet(r({ ...dibagikan }))).toEqual(["", "Di luar batas provinsi"]);
  });

  it("diminta tapi belum dibagikan, atau tidak diminta", () => {
    expect(kolomLokasiSheet(r({}))).toEqual(["", "Tidak dibagikan"]);
    expect(kolomLokasiSheet(r({ lokasiDimintaPada: null }))).toEqual(["", ""]);
  });
});
