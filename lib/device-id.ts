import { DEVICE_ID_STORAGE_KEY } from "@/lib/constants";

function formatUuidFromBytes(bytes: Uint8Array) {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));

  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

export function generateDeviceId() {
  const cryptoApi = typeof window !== "undefined" ? window.crypto : globalThis.crypto;

  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }

  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return formatUuidFromBytes(bytes);
  }

  const timestamp = Date.now().toString(16).padStart(12, "0");
  const random = Array.from({ length: 20 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `${timestamp.slice(0, 8)}-${timestamp.slice(8, 12)}-4${random.slice(0, 3)}-a${random.slice(3, 6)}-${random.slice(6, 18)}`;
}

export function getOrCreateDeviceId() {
  if (typeof window === "undefined") {
    return "";
  }

  const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);

  if (existing) {
    return existing;
  }

  const nextDeviceId = generateDeviceId();
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, nextDeviceId);
  return nextDeviceId;
}
