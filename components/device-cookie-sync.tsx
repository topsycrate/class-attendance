"use client";

import { useEffect } from "react";
import {
  DEVICE_ID_COOKIE_NAME,
  DEVICE_ID_MAX_AGE,
} from "@/lib/constants";
import { getOrCreateDeviceId } from "@/lib/device-id";

export function DeviceCookieSync() {
  useEffect(() => {
    const deviceId = getOrCreateDeviceId();

    document.cookie = `${DEVICE_ID_COOKIE_NAME}=${encodeURIComponent(
      deviceId,
    )}; path=/; max-age=${DEVICE_ID_MAX_AGE}; samesite=lax`;
  }, []);

  return null;
}
