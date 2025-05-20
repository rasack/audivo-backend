import { NextRequest, NextResponse } from "next/server";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import dbConnect from "@/lib/database/mongo";
import Score from "@/models/Score";
import Prompt from "@/models/Prompt";

export async function POST(req: NextRequest) {
  try {
    // Get the user session
    const { getUser } = getKindeServerSession();
    const user = await getUser();

    if (!user || !user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const { promptId, score, comment, quality, adherenceToPrompt, majorIssues } = await req.json();

    if (!promptId || score === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (score === -1) {
      return NextResponse.json({ error: "Give Score" }, { status: 400 });
    }

    await dbConnect();

    const prompt:any = await Prompt.findOne({ promptId });
  
    if (!prompt) {
      return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
    }

    const newScore = await Score.create({
      userId: user.id,
      promptId,
      scoreId: crypto.randomUUID(),
      score,
      comment,
      quality,
      adherenceToPrompt,
      majorIssues,
      prompt: prompt.prompt,
      responseFile: prompt.requestFile[0] || "",  
      uploadedFile: prompt.param?.[0]?.input_audio || ""
    });
    

    return NextResponse.json({ message: "Score saved successfully", newScore }, { status: 201 });
  } catch (error) {
    console.error("Error saving score:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
