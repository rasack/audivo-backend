import { NextRequest, NextResponse } from "next/server";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { z } from "zod";
import axios from "axios";
import Prompt from "@/models/Prompt";
import { FilterQuery } from "mongoose";
import dbConnect from "@/lib/database/mongo";
import { TIME_FILTER_MAPPING } from "@/lib/utils";
import { TimeFilterKey } from "@/lib/types";

const favoritesTransform = z.string().transform((val) => val.toLowerCase() === "true");

const querySchema = z.object({
  page: z.string().transform(Number).default("1"),
  limit: z.string().transform(Number).default("6"),
  timeFilter: z.string().default("all"),
  favorites: favoritesTransform.default("false"),
});

export async function GET(req: NextRequest) {
  try {
    const { getUser } = getKindeServerSession();
    const user = await getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }


    const { searchParams } = new URL(req.url);
    const params = Object.fromEntries(searchParams);
    const { page, limit, timeFilter, favorites } = querySchema.parse(params);

    await dbConnect();

    const query: FilterQuery<typeof Prompt> = {
      userId: user.id,
      isDeleted: false,
      isActive: true,
      type: 2, // Type 2 for videos
      isValid: true,
      ...(favorites ? { isFavorite: 1 } : {}),
      ...(timeFilter !== "all" && timeFilter !== "favorites" && !favorites
        ? { createdAt: TIME_FILTER_MAPPING[timeFilter as Exclude<TimeFilterKey, "favorites" | "all">]() }
        : {}),
    };
    
    const skip = (page - 1) * limit;
    const SAS_TOKEN=process.env.NEXT_PUBLIC_SAS_TOKEN;
    const [videos, totalCount] = await Promise.all([
      Prompt.find(query)
        .select("promptId prompt responseFile requestFile isFavorite type aiPrompt createdAt isAi")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Prompt.countDocuments(query),
    ]);
    for (const video of videos) {
        const fullUrl = video.requestFile[0]; // includes full Azure blob URL
        const urlObj = new URL(fullUrl);
        const blobName = urlObj.pathname.slice(1); // removes leading `/`
      
        video.requestFile[0] = `/api/video?blob=${encodeURIComponent(blobName)}`;
      }
      
    return NextResponse.json(
      { videos, totalCount },
      {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching videos:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : error,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { getUser } = getKindeServerSession();
    const user = await getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { promptId } = body;

    await dbConnect();

    const prompt = await Prompt.findOne({ promptId, userId: user.id });
    
    if (!prompt) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Toggle favorite status
    prompt.isFavorite = prompt.isFavorite === 1 ? 0 : 1;
    await prompt.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating favorite status:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : error,
      },
      { status: 500 }
    );
  }
}