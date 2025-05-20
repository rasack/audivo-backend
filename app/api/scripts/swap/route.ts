import { NextResponse } from "next/server";
import dbConnect from "@/lib/database/mongo";
import Prompt from "@/models/Prompt";

export async function GET() {
    try {
        await dbConnect();
        const prompts = await Prompt.find({
            isValid: true,
        });

      


        // await Promise.all(
        //     prompts.map(async (prompt) => {
        //         try {
             

        //             await Prompt.updateOne(
        //                 { _id: prompt._id },
        //                 {
        //                     $set: { "requestFile": prompt.responseFile },
                            
        //                 }
        //             );

        //         } catch (err) {
        //             console.error(` Error processing prompt ${prompt._id}:`, err);

        //         }
        //     })
        // );

        return NextResponse.json({ 
            message: "Files update operation completed", 
            
        }, { status: 200 });
    } catch (error:any) {
        console.error(" Error updating files:", error);
        return NextResponse.json({ 
            error: "Internal Server Error", 
            message: error.message 
        }, { status: 500 });
    }
}