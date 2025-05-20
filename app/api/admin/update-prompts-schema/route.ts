import { NextResponse } from "next/server";
import { MongoClient } from "mongodb";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import dbConnect from "@/lib/database/mongo";
import User from "@/models/User";
import { UserType } from "@/lib/types";

export async function POST() {
	await dbConnect();

	const { getUser, isAuthenticated } = getKindeServerSession();
	const user = await getUser();
	const isUserAuthenticated = await isAuthenticated();

	if (!isUserAuthenticated || !user) {
		return NextResponse.json(
			{ success: false, error: "Unauthorized" },
			{ status: 401 }
		);
	}
	const dbUser = await User.findOne({ user: user.id });
	if (!dbUser || dbUser.type !== UserType.Admin) {
		return NextResponse.json(
			{ success: false, error: "Forbidden" },
			{ status: 403 }
		);
	}

	let client;
	try {
		client = await MongoClient.connect(process.env.MONGODB_URI || "");
		const db = client.db(process.env.DB_NAME);
		const collection = db.collection("prompts");

		// Find all documents
		const totalDocuments = await collection.countDocuments();

		// Prepare bulk write operations
		const bulkOps = await collection
			.find({})
			.map((doc) => ({
				updateOne: {
					filter: { _id: doc._id, type: 0 },
					update: {
						$set: {
							...doc,
							param: {
								top_k: 250,
								top_p: 0,
								temperature: 1,
								continuation: false,
								model_version: "stereo-large",
								output_format: "wav",
								continuation_start: 0,
								multi_band_diffusion: false,
								normalization_strategy: "peak",
								classifier_free_guidance: 3,
							},
							isFavorite: doc.isFavorite ?? 0,
						},
					},
				},
			}))
			.toArray();

		const bulkOps2 = await collection
			.find({})
			.map((doc) => ({
				updateOne: {
					filter: { _id: doc._id, type: 1 },
					update: {
						$set: {
							...doc,
							param: {
								n_candidates: 3,
								guidance_scale: 2.5,
							},
							isFavorite: doc.isFavorite ?? 0,
						},
					},
				},
			}))
			.toArray();

		// Perform bulk update
		const updateResultMusic = await collection.bulkWrite(bulkOps);
		const updateResultSound = await collection.bulkWrite(bulkOps2);

		return NextResponse.json({
			totalDocuments,
			updatedDocuments:
				updateResultMusic.modifiedCount + updateResultSound.modifiedCount,
			message: "Schema update completed successfully",
		});
	} catch (error) {
		console.error("Schema update error:", error);
		return NextResponse.json(
			{
				error: "Failed to update schema",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	} finally {
		if (client) await client.close();
	}
}
