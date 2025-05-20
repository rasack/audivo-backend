import { NextRequest, NextResponse } from "next/server";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import dbConnect from "@/lib/database/mongo";
import Prompt from "@/models/Prompt";

export async function POST(req: NextRequest) {
  try {
    const { getUser } = getKindeServerSession();
    const user = await getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { promptId } = await req.json();

    if (!promptId) {
      return NextResponse.json({ error: "Video ID is required" }, { status: 400 });
    }

    await dbConnect();

    const video = await Prompt.findOne({ promptId, userId: user.id });
    
    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Instead of physically deleting, mark as deleted
    video.isDeleted = true;
    await video.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting video:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : error,
      },
      { status: 500 }
    );
  }
}