import { NextRequest, NextResponse } from "next/server";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import Prompt from "@/models/Prompt";
import dbConnect from "@/lib/database/mongo";

export async function POST(req: NextRequest) {
    try {
        await dbConnect();

        
        const { getUser } = getKindeServerSession();
        const user = await getUser();
        if (!user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        
        const { promptId } = await req.json();
        if (!promptId) {
            return NextResponse.json({ error: "Missing promptId" }, { status: 400 });
        }

        
        const updatedPrompt = await Prompt.findOneAndUpdate(
            { promptId, isDeleted: false }, 
            { isDeleted: true }, 
            { new: true } 
        );

        if (!updatedPrompt) {
            return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
        }

        return NextResponse.json({ message: "Prompt deleted successfully", prompt: updatedPrompt });
    } catch (error) {
        console.error("Error deleting prompt:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
