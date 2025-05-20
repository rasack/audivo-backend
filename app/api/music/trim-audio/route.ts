import { NextRequest, NextResponse } from 'next/server';
import { BlockBlobClient } from "@azure/storage-blob";
import fetch from 'node-fetch'; 
import https from 'https'; 
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import dbConnect from "@/lib/database/mongo";
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
const ACCOUNT_URL = process.env.NEXT_PUBLIC_ACCOUNT_URL;
const SAS_TOKEN = process.env.NEXT_PUBLIC_SAS_TOKEN;
export async function POST(req: NextRequest) {

    try {
        await dbConnect();
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
        const body = await req.json();

        let video;
        let audio
         if(body.upload_type=="video")
         {
        if (!body.video_url || body.start_time === undefined || body.end_time === undefined) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }
        video = body.video_url+"?"+SAS_TOKEN;
         }
         else if(body.upload_type=="audio")
         {
            audio = body.audio_url+"?"+SAS_TOKEN;
        if (!body.audio_url || body.start_time === undefined || body.end_time === undefined) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
            
        }
    }
     
        const agent = new https.Agent({ rejectUnauthorized: false });
          
let response:any;
          let fetchOptions;
        if(body.upload_type=="video")
            {
                fetchOptions = {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        video_url: video,
                        start_time: body.start_time.toString(),
                        end_time: body.end_time.toString(),
                    }),
                    agent, 
                };
                response = await fetch('https://10.0.0.6:5000/trim-video', fetchOptions);
            }  
            else if(body.upload_type=="audio")
            {
         fetchOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                audio_url: audio,
                start_time: body.start_time.toString(),
                end_time: body.end_time.toString(),
            }),
            agent, 
        };
        response = await fetch('https://10.0.0.6:5000/trim-audio', fetchOptions);
    }
     


        if (!response.ok) {
            throw new Error(`Error from external API: ${response.statusText}`);
        }

        const data:any = await response.json();
        if(body.upload_type=="video")
        {
            return streamBlobFromUrl(data.processed_video_url, "video");
        }
        else
        {
        return streamBlobFromUrl(data.trimmed_audio_url, "audio");
        }
    } catch (error: any) {
        console.error("API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } 
}
async function streamBlobFromUrl(azureUrl: string, uploadType: string) {
    
    const urlObj = new URL(azureUrl);
  
    const blobPath = urlObj.pathname.replace(/^\/+/, "");
  
     
   
    
    const blobClient = new BlockBlobClient(azureUrl); // Directly use the full URL with SAS token
  
    // Download the blob
    const downloadResponse = await blobClient.download(0);
  
    // Construct the cleaned blob URL (without SAS token)
    const blobUrl = `${ACCOUNT_URL}/${blobPath}`; // Removing the SAS token
    const contentLength = await getVideoSize(azureUrl);
    return new NextResponse(downloadResponse.readableStreamBody as any, {
      headers: {
        "Content-Type": uploadType === "video" ? "video/mp4" : "audio/mp3",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Transfer-Encoding": "chunked",
        "X-Blob-Url": blobUrl, 
        "size": contentLength
      },
    });
  }
  
