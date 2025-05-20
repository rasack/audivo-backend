import Replicate from "replicate";
import Prompt from "@/models/Prompt";
import { v4 as uuidv4 } from "uuid";
import dbConnect from "@/lib/database/mongo";
import { NextResponse } from "next/server";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { azureUpload, getAzureUrl } from "@/lib/azure";
import { checkUsageLimit, increaseApiUsage } from "@/lib/api-limit";
import {
	IParam,
	MusicGenerationInput,
	MusicGenerationRequest,
} from "@/lib/types";
const SAS_TOKEN = process.env.NEXT_PUBLIC_SASTOKEN;
const replicate = new Replicate({
	auth: process.env.REPLICATE_API_TOKEN,
});

let contentLength:any;
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
const validateRequest = (
	body: Partial<MusicGenerationRequest>
): { valid: boolean; error?: string } => {
	if (!body.prompt) {
		return { valid: false, error: "Prompt is required" };
	}

	if (!body.duration) {
		return { valid: false, error: "Duration is required" };
	}
	if (!body.model) {
		return { valid: false, error: "Model version is required" };
	}
	return { valid: true };
};

const createPromptRecord = async (
	userId: string,
	body: MusicGenerationRequest
): Promise<string> => {
	const promptId = uuidv4();
	const prompt = new Prompt({
		promptId,
		userId,
		type: 0,
		prompt: body.prompt,
		aiPrompt: body.aiPrompt,
		duration: body.duration,
		model: body.model,
		isFavorite: 0,
		param: body.param,
	});

	await prompt.save();
	return promptId;
};

const generateMusic = async (
	prompt: string,
	duration: number,
	param: IParam
): Promise<any> => {
	const musicSettings: IParam = {
		temperature: param.temperature,
		top_p: param.top_p,
		top_k:param.top_k,
		continuation: param.continuation,
		continuationstart: param.continuationstart,
		multi_band_diffusion: param.multi_band_diffusion,
		model_version: param.model_version,
		input_audio: param.input_audio,
		continuationend:param.continuationend,
	};
	const input: MusicGenerationInput = {
		top_k: musicSettings.top_k,
		top_p: musicSettings.top_p,
		prompt: prompt,
		duration: duration,
		temperature: musicSettings.temperature,
		continuation: musicSettings.continuation,
		model_version: musicSettings.model_version,
		output_format: "wav",
		continuation_start: Math.floor(musicSettings.continuationstart),
		continuation_end: Math.floor(musicSettings.continuationend),
		multi_band_diffusion: musicSettings.multi_band_diffusion,
		normalization_strategy: "peak",
		classifier_free_guidance: 3,
	};
	if (musicSettings.continuation && param.input_audio) {
		input.input_audio = param.input_audio;
	}
	if (param.input_audio) {
		try {
			const response = await fetch(
				`${process.env.NEXT_PUBLIC_BASE_URL}/api/music/append-signature`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ url: param.input_audio }),
				}
			);

			if (!response.ok) {
				const errorText = await response.text();
				console.error("Fetch error response:", errorText);
				throw new Error(`Failed to fetch audio file: ${errorText}`);
			}

			const { url: signedUrl } = await response.json();
			input.input_audio = signedUrl;
		} catch (error) {
			console.error("Error preparing input audio:", error);
			throw new Error("Input audio is required for continuation");
		}
	}

	try {
		const response = await replicate.run(
			"meta/musicgen:b05b1dff1d8c6dc63d14b0cdb42135378dcb87f6373b0d3d341ede46e59e2b38",
			{ input }
		);

		return response;
	
	}
	 catch (error) {
		console.error("Error from Replicate API:", error);
		throw new Error(`Replicate API error`);
	}
};

async function getAndStoreAzureUrl(response: string, filename: string) {
	try {
	
		contentLength=await getVideoSize(String(response));
	
		await azureUpload(String(response), filename, "music", 2);
		const azureUrl = getAzureUrl("music", filename);
		
		return azureUrl;
	} catch (error) {
		throw new Error("Failed to upload and get Azure URL after retries");
	}
}

export async function POST(req: Request) {
	if (req.method !== "POST") {
		return new NextResponse("Method not allowed", { status: 405 });
	}
	const id = uuidv4();
	await dbConnect();
	try {
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

		// 2. Request Validation
		const body1 = await req.json();
		const { param: { variation, ...restParam }, isCopyright, ...body } = body1;
		body.param = restParam;
         const valid=body1.param.variation;
		  if(valid)
		  {
			body1.param.continuationstart=-1;
			body1.param.continuationend=-1;
		  }
		let { duration, prompt, aiPrompt, isAi } = body;
		if(body.param.input_audio)
		{
        body.param.input_audio = body.param.input_audio+"?"+SAS_TOKEN;
		}
		const validation = validateRequest(body);
		if (!validation.valid) {
			return new NextResponse(validation.error, { status: 400 });
		}

		// 3. Usage Limit Check
		const { allowed } = await checkUsageLimit(userId);

		if (!allowed) {
			return new NextResponse(
				JSON.stringify({
					error: "Usage limit reached",
				}),
				{ status: 403 }
			);
		}

		// 4. Generate Music
		const response = await generateMusic(
			isAi ? aiPrompt : prompt,
			body.duration,
			{
				...body.param,
			}
		);

		// 5. Attempt Azure Upload
		const filename = "music_" + duration + "_" + id;
		let azureUrl;
		try {
			azureUrl = await getAndStoreAzureUrl(String(response), filename);
			
			
		} catch (uploadError) {
			console.error("Failed to get Azure URL:", uploadError);
			return new NextResponse(
				JSON.stringify({
					error: "Failed to store the generated music",
				}),
				{ status: 500 }
			);
		}
		// 6. Create Prompt Record ONLY if Azure upload succeeds
		const promptId = await createPromptRecord(userId, body1);

		// 7. Update Record with Response
		const updatedPrompt = await Prompt.findOneAndUpdate(
			{ promptId: promptId },
			{
				$set: { response: response },
				$push: { requestFile: azureUrl, responseFile: azureUrl },
				isCopyright:body1.isCopyright
			},
			
			{ new: true }
		);
        if (!updatedPrompt) {
			throw new Error(`Failed to update prompt with ID: ${promptId}`);
		}

		// 8. Increment Usage Count
		await increaseApiUsage(user);
        
		// 9. Return Response
		return NextResponse.json({
			audiourl: azureUrl,
			promptId,
			prompt: body.prompt,
			aiPrompt: body.aiPrompt,
			isFavorite: 0,
			success: true,
			type: 0,
			size:contentLength
		});
	} catch (error) {
		console.error("Error processing music prompt:", error);
		return new NextResponse(
			JSON.stringify({
				error: error instanceof Error ? error.message : "Internal server error",
			}),
			{ status: 500 }
		);
	}
}
