function getForwardedOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");

  if (!host) {
    return new URL(request.url).origin;
  }

  const forwardedProto =
    request.headers.get("x-forwarded-proto") ||
    new URL(request.url).protocol.replace(":", "");

  return `${forwardedProto}://${host}`;
}

export function buildRedirectUrl(request: Request, pathname: string) {
  return new URL(pathname, getForwardedOrigin(request));
}
