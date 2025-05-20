import { NextRequest, NextResponse } from "next/server";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import dbConnect from "@/lib/database/mongo";
import Prompt from "@/models/Prompt";

export async function GET(req: NextRequest) {
    const { getUser } = getKindeServerSession();
    const user = await getUser();


    try {
        await dbConnect();

        console.log("🔍 Fetching prompts for cleaning...");
        const prompts = await Prompt.find(
            { responseFile: { $exists: true, $ne: [] } },
            "promptId responseFile"
        );

     

        // for (const prompt of prompts) {
        //     const files = Array.isArray(prompt.responseFile) ? prompt.responseFile : [];

          
        //     const cleanedFiles = files.map((url: string) =>
        //         url.includes("sp=") ? url.split("sp=")[0] : url
        //     );
          
        //     if (JSON.stringify(cleanedFiles) !== JSON.stringify(files)) {
        //         await Prompt.updateOne(
        //             { _id: prompt._id },
        //             { $set: { responseFile: cleanedFiles } }
        //         );
     
        //     }
        // }

     
        return NextResponse.json({ message: "Cleaning completed successfully." });
    } catch (error) {
        console.error("❌ Error cleaning files:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
