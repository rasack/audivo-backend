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
		const totalDocuments = await collection.countDocuments();

		const bulkOps = await collection
			.find({ requestFile: { $exists: true, $ne: [] } })
			.map((doc) => ({
				updateOne: {
					filter: { _id: doc._id },
					update: {
						$set: {
							requestFile: doc.requestFile.map(
								(url: string) => url.split("?")[0]
							),
						},
					},
				},
			}))
			.toArray();

		const updateResult = await collection.bulkWrite(bulkOps);
		return NextResponse.json({
			totalDocuments,
			updatedDocuments: updateResult.modifiedCount,
			message: "SAS tokens removed from requestFile URLs successfully",
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
