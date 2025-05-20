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

		// Perform unset operation
		const unsetResult = await collection.updateMany(
			{},
			{ $unset: { response: "" } }
		);

		return NextResponse.json({
			totalDocuments,
			updatedDocuments: unsetResult.modifiedCount,
			message: "Response field unset completed successfully",
		});
	} catch (error) {
		console.error("Unset operation error:", error);
		return NextResponse.json(
			{
				error: "Failed to unset response field",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	} finally {
		if (client) await client.close();
	}
}
