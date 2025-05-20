import { NextRequest, NextResponse } from "next/server";
import { BlobServiceClient } from "@azure/storage-blob";
import { v4 as uuidv4 } from "uuid";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import dbConnect from "@/lib/database/mongo";

const ACCOUNT_URL = process.env.NEXT_PUBLIC_ACCOUNT_URL;
const SAS_TOKEN = process.env.NEXT_PUBLIC_SAS_TOKEN;

const blobServiceClient = new BlobServiceClient(`${ACCOUNT_URL}?${SAS_TOKEN}`);
const containerClient = blobServiceClient.getContainerClient("upload-temp");

export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    // Authenticate User
    const { isAuthenticated, getUser } = getKindeServerSession();
    if (!(await isAuthenticated())) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await getUser();
    const userId = user?.id;
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const uploadtype = formData.get("operation") as string;
    const file = formData.get("file") as File;
    const filetype = formData.get("filetype") as string;
    const chunkIndex = parseInt(formData.get("chunkIndex") as string, 10);
    const totalChunks = parseInt(formData.get("totalChunks") as string, 10);
    const fileName = formData.get("fileName") as string;
    if (!file || !filetype || !uploadtype) {
      return NextResponse.json({ message: "Invalid form data" }, { status: 400 });
    }

    let allowedTypes: string[];
    if (uploadtype === "video") {
      allowedTypes = [
        "video/mp4",
        "video/webm",
        "video/ogg",
        "video/x-msvideo",
        "video/quicktime",
        "video/x-matroska",
      ];
    } else {
      allowedTypes = ["audio/mpeg", "audio/wav", "video/mp4"];
    }

    if (!allowedTypes.includes(filetype)) {
      return NextResponse.json({ message: "Invalid file type" }, { status: 400 });
    }

    if (uploadtype === "video" && file.size > 250 * 1024 * 1024) {
      return NextResponse.json({ message: "File is too large" }, { status: 400 });
    } else if (uploadtype !== "video" && file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ message: "File is too large" }, { status: 400 });
    }


    const chunkBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(chunkBuffer);
    const chunkBlobName = `${fileName}-chunk-${chunkIndex + 1}`;
    const blockBlobClient = containerClient.getBlockBlobClient(chunkBlobName);
    await blockBlobClient.uploadData(fileBuffer, { blobHTTPHeaders: { blobContentType: file.type } });

    if (chunkIndex === totalChunks - 1) {
      const finalFileName = `${fileName}-${uuidv4()}${uploadtype === "video" ? ".mp4" : ".mp3"}`;
      await mergeChunksAndUploadToAzure(fileName, totalChunks, finalFileName, uploadtype);
      
      return streamBlob(finalFileName, uploadtype);
    }

    return NextResponse.json({ message: "Chunks still uploading" });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json({ message: "File upload failed" }, { status: 500 });
  }
}


async function mergeChunksAndUploadToAzure(fileName: string, totalChunks: number, finalFileName: string, uploadtype: string) {
  const finalBlobClient = containerClient.getBlockBlobClient(finalFileName);
  const chunkBlobs: string[] = [];

  for (let i = 1; i <= totalChunks; i++) {
    chunkBlobs.push(`${fileName}-chunk-${i}`);
  }

  const downloadPromises = chunkBlobs.map(async (chunkBlobName) => {
    const chunkBlobClient = containerClient.getBlockBlobClient(chunkBlobName);
    const downloadResponse = await chunkBlobClient.download(0);
    const chunkBuffer = await streamToBuffer(downloadResponse.readableStreamBody!);
    await chunkBlobClient.delete(); 
    return chunkBuffer;
  });

  try {
    const chunkBuffers = await Promise.all(downloadPromises);
    const finalFileBuffer = Buffer.concat(chunkBuffers);

    await finalBlobClient.uploadData(finalFileBuffer, {
      blobHTTPHeaders: { blobContentType: uploadtype === "video" ? "video/mp4" : "audio/mp3" },
    });
  } catch (error) {
    console.error("Error during chunk merging or uploading:", error);
  }
}




async function streamToBuffer(readableStream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    readableStream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    readableStream.on("end", () => resolve(Buffer.concat(chunks)));
    readableStream.on("error", reject);
  });
}


async function streamBlob(blobName: string, uploadtype: string) {
  const blobClient = containerClient.getBlockBlobClient(blobName);
  const blobUrl = `${ACCOUNT_URL}/upload-temp/${blobName}`;
  const downloadResponse = await blobClient.download(0);
  return new NextResponse(downloadResponse.readableStreamBody as any, {
    headers: {
      "Content-Type": uploadtype === "video" ? "video/mp4" : "audio/mp3",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Transfer-Encoding": "chunked",
      "X-Blob-Url": blobUrl,
    },
  });
}
