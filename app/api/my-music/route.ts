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
	type: z.enum(["all", "music", "sound"]).default("all"),
});



export async function GET(req: NextRequest) {
	try {
		const { getUser } = getKindeServerSession();
		const user = await getUser();

		if (!user?.id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}


		
        const cleanResponse1 = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/scripts/valid`);


		const { searchParams } = new URL(req.url);
		const params = Object.fromEntries(searchParams);
		const { page, limit, timeFilter, favorites, type } = querySchema.parse(params);

		await dbConnect();

		const query: FilterQuery<typeof Prompt> = {
			userId: user.id,
			isDeleted: false,
			isActive: true,
			type: { $in: [0, 1] },
			isValid: true,
			...(favorites ? { isFavorite: 1 } : {}),
			...(timeFilter !== "all" && timeFilter !== "favorites" && !favorites
				? { createdAt: TIME_FILTER_MAPPING[timeFilter as Exclude<TimeFilterKey, "favorites" | "all">]() }
				: {}),
		};
		
		const skip = (page - 1) * limit;

		const [music, totalCount] = await Promise.all([
			Prompt.find(query)
				.select("promptId prompt responseFile requestFile isFavorite type aiPrompt createdAt isAi")
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.lean(),
			Prompt.countDocuments(query),
		]);
		console.log(music);

		return NextResponse.json(
			{ music, totalCount },
			{
				headers: {
					"Cache-Control": "no-cache, no-store, must-revalidate",
					Pragma: "no-cache",
					Expires: "0",
				},
			}
		);
	} catch (error) {
		console.error("Error fetching music:", error);
		return NextResponse.json(
			{
				error: "Internal server error",
				details: error instanceof Error ? error.message : error,
			},
			{ status: 500 }
		);
	}
}

export async function PUT(req: NextRequest) {
	try {
		const { getUser } = getKindeServerSession();
		const user = await getUser();

		if (!user?.id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { promptId } = await req.json();

		if (!promptId) {
			return NextResponse.json(
				{ error: "Prompt ID is required" },
				{ status: 400 }
			);
		}

		await dbConnect();

		const prompt = await Prompt.findOne({
			promptId,
			userId: user.id,
		});

		if (!prompt) {
			return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
		}

		const updatedPrompt = await Prompt.findOneAndUpdate(
			{ promptId },
			{ $set: { isFavorite: prompt.isFavorite === 1 ? 0 : 1 } },
			{ new: true }
		).select("promptId isFavorite");

		return NextResponse.json(
			{ success: true, prompt: updatedPrompt },
			{
				headers: {
					"Cache-Control": "no-cache, no-store, must-revalidate",
					Pragma: "no-cache",
					Expires: "0",
				},
			}
		);
	} catch (error) {
		console.error("Error updating favorite:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
