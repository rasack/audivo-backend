import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const blobName = searchParams.get("blob");

  if (!blobName) {
    return new Response("Missing blob name", { status: 400 });
  }

  const SAS_TOKEN = process.env.NEXT_PUBLIC_SAS_TOKEN;
  const STORAGE_URL = process.env.NEXT_PUBLIC_ACCOUNT_URL; 

  const azureUrl = `${STORAGE_URL}/${blobName}?${SAS_TOKEN}`;

  try {
    const response = await fetch(azureUrl);
    if (!response.ok) throw new Error("Failed to fetch blob from Azure");

    const stream = response.body;

    const headers = new Headers();
    headers.set("Content-Type", response.headers.get("Content-Type") || "application/octet-stream");
    headers.set("Content-Length", response.headers.get("Content-Length") || "");

    return new Response(stream, {
      status: 200,
      headers,
    });
  } catch (err: any) {
    return new Response(`Error streaming video: ${err.message}`, { status: 500 });
  }
}
