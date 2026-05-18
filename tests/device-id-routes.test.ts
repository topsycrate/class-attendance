import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const actionMocks = vi.hoisted(() => ({
  bindStudentDevice: vi.fn(),
  getDeviceStatus: vi.fn(),
  getSignContext: vi.fn(),
  verifyAndSign: vi.fn(),
}));

vi.mock("@/lib/actions", () => ({
  bindStudentDevice: actionMocks.bindStudentDevice,
  getDeviceStatus: actionMocks.getDeviceStatus,
  getSignContext: actionMocks.getSignContext,
  verifyAndSign: actionMocks.verifyAndSign,
}));

vi.mock("@/lib/db", () => ({
  formatDatabaseError: (error: unknown) => String(error),
}));

import { POST as bindPost } from "@/app/api/bind/route";
import { GET as deviceStatusGet } from "@/app/api/device/status/route";
import { POST as signPost } from "@/app/api/sign/route";
import { GET as signSessionGet } from "@/app/api/sign/session/route";

describe("device id route trust boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actionMocks.getDeviceStatus.mockResolvedValue({
      device_id: "cookie-device",
      is_bound: false,
    });
    actionMocks.getSignContext.mockResolvedValue({
      success: false,
      code: "NOT_AUTHENTICATED",
      message: "请先登录学生账号",
    });
    actionMocks.verifyAndSign.mockResolvedValue({
      success: false,
      code: "NOT_AUTHENTICATED",
      message: "请先登录学生账号",
    });
    actionMocks.bindStudentDevice.mockResolvedValue({
      success: true,
      message: "学生信息确认成功",
      device_id: "cookie-device",
      student: {
        id: "student-1",
        name: "张三",
        student_id: "2026001",
        class_name: "一班",
      },
    });
  });

  it("prefers cookie device_id for device status", async () => {
    const request = new NextRequest(
      "http://localhost/api/device/status?device_id=query-device",
      {
        headers: {
          cookie: "attendance_device_id=cookie-device",
        },
      },
    );

    await deviceStatusGet(request);

    expect(actionMocks.getDeviceStatus).toHaveBeenCalledWith("cookie-device");
  });

  it("prefers cookie device_id for sign context", async () => {
    const request = new NextRequest(
      "http://localhost/api/sign/session?session_id=session-1&device_id=query-device",
      {
        headers: {
          cookie: "attendance_device_id=cookie-device",
        },
      },
    );

    await signSessionGet(request);

    expect(actionMocks.getSignContext).toHaveBeenCalledWith({
      session_id: "session-1",
      device_id: "cookie-device",
    });
  });

  it("prefers cookie device_id for sign submission", async () => {
    const request = new NextRequest("http://localhost/api/sign", {
      method: "POST",
      headers: {
        cookie: "attendance_device_id=cookie-device",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        session_id: "session-1",
        device_id: "body-device",
      }),
    });

    await signPost(request);

    expect(actionMocks.verifyAndSign).toHaveBeenCalledWith({
      session_id: "session-1",
      device_id: "cookie-device",
    });
  });

  it("prefers cookie device_id for bind submission", async () => {
    const request = new NextRequest("http://localhost/api/bind", {
      method: "POST",
      headers: {
        cookie: "attendance_device_id=cookie-device",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        student_id: "2026001",
        name: "张三",
        class_name: "一班",
        device_id: "body-device",
      }),
    });

    await bindPost(request);

    expect(actionMocks.bindStudentDevice).toHaveBeenCalledWith({
      student_id: "2026001",
      name: "张三",
      class_name: "一班",
      device_id: "cookie-device",
    });
  });
});
