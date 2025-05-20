import Replicate from "replicate";
import { BlobServiceClient } from "@azure/storage-blob";
import { NextResponse } from "next/server";
import Prompt from "@/models/Prompt";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
const ACCOUNT_URL = process.env.NEXT_PUBLIC_ACCOUNT_URL;
const SAS_TOKEN = process.env.NEXT_PUBLIC_SAS_TOKEN;

const blobServiceClient = new BlobServiceClient(`${ACCOUNT_URL}?${SAS_TOKEN}`);
const containerClient = blobServiceClient.getContainerClient("upload-temp");
async function getVideoSize(url:any) {
   
    try {
        const response = await fetch(url, { method: 'HEAD' });
        const contentLength:any = response.headers.get('Content-Length');
  
        if (contentLength) {
            console.log(`Size: ${(contentLength / (1024 * 1024)).toFixed(2)} MB`);
            return contentLength;
        } else {
            console.log("Content-Length header is missing.");
            return null;
        }
    } catch (error) {
        console.error("Error fetching video size:", error);
    }
  }
  let contentLength:any;
async function uploadToAzure(responseUrl: any, filename: string) {

    try {
        // Fetch file from Replicate response URL
        console.log(responseUrl);
        contentLength=await getVideoSize(responseUrl);
        console.log(contentLength);
        const response = await fetch(responseUrl);
        if (!response.ok) {
            throw new Error("Failed to fetch the generated file");
        }
        
        const fileBuffer = await response.arrayBuffer();
        const blockBlobClient = containerClient.getBlockBlobClient(filename);
        
        // Upload directly to Azure
        await blockBlobClient.uploadData(Buffer.from(fileBuffer), {
            blobHTTPHeaders: { blobContentType: "video/mp4" },
        });
        
        return `${ACCOUNT_URL}/upload-temp/${filename}`;
    } catch (error) {
        console.error("Azure Upload Error:", error);
        throw new Error("Azure Upload Failed");
    }
}

export async function POST(req: Request) {
    const { isAuthenticated, getUser } = getKindeServerSession();
    const authenticated = await isAuthenticated();
		if (!authenticated) {
			return new NextResponse("Unauthorized", { status: 401 });
		}
    const user = await getUser();
	const userId = user?.id;
    if (!userId) {
			return new NextResponse("Unauthorized", { status: 401 });
	}
    try {
        const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
        
        let { video, negative_prompt,promptduration,prompt } = await req.json();
        const duration=promptduration;
        const input_video=video;
        video = video+"?"+SAS_TOKEN;
        
        if (!video) {
            return NextResponse.json({ error: "Missing required fields: video and prompt" }, { status: 400 });
        }

        const input = { video, negative_prompt,duration,prompt };
        
        const response = await replicate.run(
            "zsxkib/mmaudio:4b9f801a167b1f6cc2db6ba7ffdeb307630bf411841d4e8300e63ca992de0be9",
            { input }
        );

        const filename = `video_${Date.now()}.mp4`;
        
        try {
            const azureUrl = await uploadToAzure(response, filename);
            console.log(azureUrl)
            const newPrompt = await Prompt.create({
                type:2,
                negative_prompt:negative_prompt,
                prompt:prompt,
                userId:userId,
                duration:duration,
                requestFile: [azureUrl], 
                responseFile: [azureUrl],
                param:{
                  input_video:input_video
                },
                response:response
              });
              console.log(newPrompt);
            return streamBlob(filename, "video");
        } catch (uploadError) {
            console.error("Failed to upload to Azure:", uploadError);
            return new NextResponse(
                JSON.stringify({ error: "Failed to store the generated file" }),
                { status: 500 }
            );
        }
    } catch (error) {
        console.error("Error processing request:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
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
      "X-Blob-Url": blobName,
      "size":contentLength
    },
  });
}