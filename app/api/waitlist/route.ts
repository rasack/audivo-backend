import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/database/mongo";
import WaitlistedUser from "@/models/waitlistedUser";

export async function POST(req: NextRequest) {
	try {
		await dbConnect();
		const { name, email } = await req.json();

		// Validate input
		if (!name || !email) {
			return NextResponse.json(
				{ error: "Name and Email are required" },
				{ status: 400 }
			);
		}

		// Check if user already exists
		const existingUser = await WaitlistedUser.findOne({ email });
		if (existingUser) {
			return NextResponse.json(
				{ error: "Email is already registered" },
				{ status: 409 }
			);
		}

		// Save new waitlisted user
		const newUser = new WaitlistedUser({ name, email });
		await newUser.save();

		return NextResponse.json(
			{ message: "Successfully added to the waitlist" },
			{ status: 201 }
		);
	} catch (error) {
		console.error("Error saving waitlisted user:", error);
		return NextResponse.json(
			{ error: "Internal Server Error" },
			{ status: 500 }
		);
	}
}
