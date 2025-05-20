import { NextRequest, NextResponse } from "next/server";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import dbConnect from "@/lib/database/mongo";
import Prompt from "@/models/Prompt";
import { revalidatePath } from "next/cache";




export async function GET(req: NextRequest) {
    const { getUser } = getKindeServerSession();
    const user = await getUser();

    if (!user || !user.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        await dbConnect();
        const sasToken = process.env.NEXT_PUBLIC_STORAGE_SASTOKEN;
     
        // const cleanResponse1 = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/scripts/valid`);
     
         
        const prompts = await Prompt.find(
            { 
                type: { $in: [0, 1] },  
                isValid: true
            },  
            "promptId prompt responseFile"
        ).sort({ createdAt: -1 });
        

        const updatedPrompts = await Promise.all(
            prompts?.map(async (prompt) => {
                const validFiles = prompt?.responseFile
                    ? await Promise.all(
                          prompt.responseFile?.map(async (url: string) => {
                              const fullUrl = url+"?"+sasToken;
                              return  fullUrl
                          })
                      )
                    : [];

                const filteredFiles = validFiles
                 

                return {
                    promptId: prompt.promptId,
                    prompt: prompt.prompt,
                    requestFile: filteredFiles,
                };
            })
        );
        revalidatePath("/score");
        return NextResponse.json(updatedPrompts.filter(Boolean));
    } catch (error) {
        console.error("Error fetching prompts:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
