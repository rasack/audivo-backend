import { NextResponse } from "next/server";
import dbConnect from "@/lib/database/mongo";
import Prompt from "@/models/Prompt";
import Replicate from "replicate";
import { azureUpload, getAzureUrl } from "@/lib/azure";
import { v4 as uuidv4 } from "uuid";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

async function getAndStoreAzureUrl(response: string, filename: string) {
    try {
        await azureUpload(response, filename, "music", 2);
        return getAzureUrl("music", filename);
    } catch (error) {
        throw new Error("Failed to upload and get Azure URL after retries");
    }
}

export async function POST(): Promise<any> {
    try {
        await dbConnect();
        const prompts: any[] = await Prompt.find({
            type: { $in: [0, 1] },
            isValid: false,
        });

        if (prompts.length === 0) {
            console.log("No prompts found to process.");
            return NextResponse.json({ message: "No prompts found" }, { status: 404 });
        }

       
        let processedCount = 0;
        for (const prompt of prompts) {
            console.log(`Processing prompt: ${prompt._id}`);

            try {
                const output = await replicate.run(
                    "meta/musicgen:b05b1dff1d8c6dc63d14b0cdb42135378dcb87f6373b0d3d341ede46e59e2b38",
                    {
                        input: {
                            prompt: prompt.prompt,
                            top_k: prompt.param.top_k,
                            top_p: prompt.param.top_p,
                            duration: prompt.duration,
                            temperature: prompt.param.temperature,
                            continuation: false,
                            model_version: prompt.param.model_version,
                            output_format: "wav",
                            continuation_start: 0,
                            multi_band_diffusion: false,
                            normalization_strategy: prompt.param.normalization_strategy,
                            classifier_free_guidance: prompt.param.classifier_free_guidance,
                        }
                    }
                );

                const id = uuidv4();
                const filename = `music_${prompt.duration}_${id}`;
                let azureUrl;

                try {
                    azureUrl = await getAndStoreAzureUrl(String(output), filename);
                } catch (uploadError) {
                    console.error(`Failed to upload for prompt ${prompt._id}:`, uploadError);
                    continue;
                }
           
           
                await Prompt.updateOne(
                    { _id: prompt._id },
                    {
                        $set: { responseFile: [azureUrl],response: output ,requestFile:[]},
                    }
                );

                console.log(`Successfully processed prompt: ${prompt._id}`);
                processedCount++;
            } catch (error) {
                console.error(` Error processing prompt ${prompt._id}:`, error);
            }
        }

        console.log(`Processing complete. Successfully processed ${processedCount}/${prompts.length} prompts.`);
        return NextResponse.json({ message: "Processing complete", processed: processedCount }, { status: 200 });

    } catch (error: any) {
        console.error(" Error updating files:", error);
        return NextResponse.json(
            { error: "Internal Server Error", message: error.message },
            { status: 500 }
        );
    }
}
