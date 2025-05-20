import { NextResponse } from "next/server";
import Replicate from "replicate";
import { v4 as uuidv4 } from "uuid";

import { checkUsageLimit, increaseApiUsage } from "@/lib/api-limit";
import { azureUpload, getAzureUrl } from "@/lib/azure";
import dbConnect from "@/lib/database/mongo";
import {
	IParam,
	MusicGenerationRequest,
	SoundGenerationInput,
} from "@/lib/types";
import Prompt from "@/models/Prompt";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";

const replicate = new Replicate({
	auth: process.env.REPLICATE_API_TOKEN!,
});

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
		type: 1,
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

const generateSound = async (
	prompt: string,
	duration: number,
	n_candidates: number,
	guidance_scale: number
): Promise<object> => {
	const input: SoundGenerationInput = {
		text: prompt,
		duration: duration,
		n_candidates: n_candidates,
		guidance_scale: guidance_scale,
	};

	const response = await replicate.run(
		"haoheliu/audio-ldm:b61392adecdd660326fc9cfc5398182437dbe5e97b5decfb36e1a36de68b5b95",
		{
			input: {
				...input,
				duration: String(
					input.duration === 0
						? "2.5"
						: input.duration <= 2.5
						? "2.5"
						: input.duration <= 5.0
						? "5.0"
						: input.duration <= 7.5
						? "7.5"
						: input.duration <= 10.0
						? "10.0"
						: input.duration <= 12.5
						? "12.5"
						: input.duration <= 15.0
						? "15.0"
						: input.duration <= 17.5
						? "17.5"
						: "20.0"
				),
			},
		}
	);

	return response;
	// return "https://replicate.delivery/pbxt/dzewEleNeafuBTi6EfBzOD8yHfqnrm6D2HBjsBVS6PxxuCBoE/out.wav";
};

async function getAndStoreAzureUrl(response: string, filename: string) {
	try {
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
		const body = await req.json();
		const { duration, prompt, aiPrompt, isAi, param } = body;

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
		// 4. Generate Sound
		const response = await generateSound(
			isAi ? aiPrompt : prompt,
			duration,
			param.n_candidates,
			param.guidance_scale
		);

		// 5. Attempt Azure Upload
		const filename = "sound_" + duration + "_" + id;
		let azureUrl;
		try {
			azureUrl = await getAndStoreAzureUrl(String(response), filename);
		} catch (error) {
			console.error("Failed to get Azure URL:", error);
			return new NextResponse(
				JSON.stringify({
					error: "Failed to store the generated sound",
				}),
				{ status: 500 }
			);
		}

		// 6. Create Prompt Record ONLY if Azure upload succeeds
		const promptId = await createPromptRecord(userId, body);

		// 7. Update Record with Response
		const updatedPrompt = await Prompt.findOneAndUpdate(
			{ promptId: promptId },
			{
				// $set: { response: response },
				$push: { requestFile: azureUrl, responseFile: response },
			},
			{ new: true }
		);

		if (!updatedPrompt) {
			throw new Error(`Failed to update prompt with ID: ${promptId}`);
		}

		// 8. Increment Usage Count only after successful generation
		await increaseApiUsage(user);

		// 9. Return Response
		return NextResponse.json({
			audioUrl: azureUrl,
			promptId,
			prompt: body.prompt,
			aiPrompt: body.aiPrompt,
			isFavorite: 0,
			type: 1,
			success: true,
		});
	} catch (error) {
		console.error("Error processing sound prompt:", error);
		return new NextResponse(
			JSON.stringify({
				error: error instanceof Error ? error.message : "Internal server error",
			}),
			{ status: 500 }
		);
	}
}
