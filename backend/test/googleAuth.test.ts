import { describe, it, expect } from "vitest";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { buildJwt, parseServiceAccount, GOOGLE_TOKEN_URL, SHEETS_SCOPE } from "../src/lib/googleAuth.js";

// Keypair RSA sungguhan supaya tanda tangannya bisa DIVERIFIKASI, bukan cuma dicek ada.
const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
const sa = { client_email: "bot@proyek.iam.gserviceaccount.com", private_key: privateKey };

const decodePart = (jwt: string, i: number) => JSON.parse(Buffer.from(jwt.split(".")[i]!, "base64url").toString());

describe("parseServiceAccount", () => {
  it("menerima JSON kunci yang sah", () => {
    const raw = JSON.stringify({ type: "service_account", client_email: sa.client_email, private_key: "PK" });
    expect(parseServiceAccount(raw)).toEqual({ client_email: sa.client_email, private_key: "PK" });
  });

  it("menolak yang bukan JSON dengan pesan menunjuk penyebab", () => {
    expect(() => parseServiceAccount("bukan json")).toThrow(/Bukan JSON/);
  });

  it("menolak JSON tanpa client_email/private_key", () => {
    expect(() => parseServiceAccount("{}")).toThrow(/client_email/);
    expect(() => parseServiceAccount(JSON.stringify({ client_email: "a@b.c" }))).toThrow(/private_key/);
  });

  it("menolak kredensial bertipe lain (mis. OAuth client)", () => {
    const raw = JSON.stringify({ type: "authorized_user", client_email: "a@b.c", private_key: "PK" });
    expect(() => parseServiceAccount(raw)).toThrow(/service_account/);
  });
});

describe("buildJwt", () => {
  const NOW = 1_753_900_000;
  const jwt = buildJwt(sa, SHEETS_SCOPE, NOW);

  it("header dan claims sesuai spesifikasi JWT Bearer Google", () => {
    expect(decodePart(jwt, 0)).toEqual({ alg: "RS256", typ: "JWT" });
    expect(decodePart(jwt, 1)).toEqual({
      iss: sa.client_email,
      scope: SHEETS_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: NOW,
      exp: NOW + 3600,
    });
  });

  it("tanda tangan RS256 terverifikasi dengan public key pasangannya", () => {
    const [h, c, s] = jwt.split(".");
    const valid = createVerify("RSA-SHA256").update(`${h}.${c}`).verify(publicKey, Buffer.from(s!, "base64url"));
    expect(valid).toBe(true);
  });

  it("tanda tangan TIDAK terverifikasi bila payload diubah (bukan sekadar string tempelan)", () => {
    const [h, , s] = jwt.split(".");
    const palsu = Buffer.from(JSON.stringify({ iss: "penyusup@x.y" })).toString("base64url");
    const valid = createVerify("RSA-SHA256").update(`${h}.${palsu}`).verify(publicKey, Buffer.from(s!, "base64url"));
    expect(valid).toBe(false);
  });
});
