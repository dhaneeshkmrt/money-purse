import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const ALLOWED_ORIGIN = "https://pm2-stock-portfolio.netlify.app";

function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  } as const;
}

function sanitizeFilename(filename: string): string {
  const trimmed = filename.trim() || "download";
  return trimmed.replace(/[\\/:*?"<>|\s]+/g, "_").replace(/^\.+/, "");
}

function getFilenameFromUrl(url: URL): string {
  const pathname = url.pathname.split("/").filter(Boolean);
  const fallback = pathname[pathname.length - 1] || "download";
  return sanitizeFilename(fallback || "download");
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json(
      { error: "Missing required 'url' query parameter." },
      { status: 400 }
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL provided." }, { status: 400 });
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return NextResponse.json(
      { error: "Only http and https URLs are supported." },
      { status: 400 }
    );
  }

  try {
    const upstreamResponse = await fetch(parsedUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        { error: `Remote file request failed with status ${upstreamResponse.status}.` },
        { status: 502 }
      );
    }

    const contentType =
      upstreamResponse.headers.get("content-type")?.split(";")[0] ||
      "application/octet-stream";

    const filename = getFilenameFromUrl(parsedUrl);
    const headers = new Headers({
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      ...getCorsHeaders(),
    });

    const contentLength = upstreamResponse.headers.get("content-length");
    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }

    return new NextResponse(upstreamResponse.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Download proxy failed:", error);
    return NextResponse.json(
      { error: "Unable to download the requested file." },
      { status: 502 }
    );
  }
}
