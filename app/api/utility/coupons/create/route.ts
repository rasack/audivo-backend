import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/database/mongo";
import Coupon from "@/models/Coupon";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import User from "@/models/User";
import { UserType } from "@/lib/types";

export async function POST(req: NextRequest) {
	try {
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

		// Ensure the user exists and is an admin
		if (!dbUser || dbUser.type !== UserType.Admin) {
			return NextResponse.json(
				{ success: false, error: "Forbidden" },
				{ status: 403 }
			);
		}

		const { code, discountType, discountValue, expiryDate, maxUses } =
			await req.json();

		if (!code || !discountType || !discountValue || !expiryDate || !maxUses) {
			return NextResponse.json(
				{ success: false, error: "Missing required fields" },
				{ status: 400 }
			);
		}

		const newCoupon = new Coupon({
			code,
			discountType,
			discountValue,
			expiryDate: new Date(expiryDate),
			maxUses,
		});

		await newCoupon.save();

		return NextResponse.json({
			success: true,
			message: "Coupon created successfully",
			coupon: newCoupon,
		});
	} catch (error) {
		if (error instanceof Error) {
			console.error("Coupon creation error:", error.message);
			return NextResponse.json(
				{
					success: false,
					message: error.message || "Failed to create coupon",
				},
				{ status: 500 }
			);
		} else {
			console.error("Unknown error:", error);
			return NextResponse.json(
				{
					success: false,
					message: "An unknown error occurred",
				},
				{ status: 500 }
			);
		}
	}
}
