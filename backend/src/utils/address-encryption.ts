import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { env } from "../config/env.js";

const encryptionKey = Buffer.from(
  env.COLLECTION_ADDRESS_ENCRYPTION_KEY,
  "hex",
);

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypts a service address using AES-256-GCM.
 * Stored format: 12-byte IV + 16-byte authentication tag + ciphertext.
 */
export function encryptAddress(address: string): Buffer {
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);

  const ciphertext = Buffer.concat([
    cipher.update(address, "utf8"),
    cipher.final(),
  ]);

  const authenticationTag = cipher.getAuthTag();

  return Buffer.concat([iv, authenticationTag, ciphertext]);
}

/**
 * Decrypts an address previously encrypted by encryptAddress().
 */
export function decryptAddress(payload: Buffer): string {
  if (payload.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Encrypted address payload is invalid.");
  }

  const iv = payload.subarray(0, IV_LENGTH);
  const authenticationTag = payload.subarray(
    IV_LENGTH,
    IV_LENGTH + AUTH_TAG_LENGTH,
  );
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey, iv);
  decipher.setAuthTag(authenticationTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
