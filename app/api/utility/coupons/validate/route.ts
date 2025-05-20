import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/database/mongo";
import Coupon from "@/models/Coupon";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { calculatePricing } from "@/lib/pricing";
import AdminSettings from "@/models/AdminSettings";

export async function POST(req: NextRequest) {
	try {
		const { getUser, isAuthenticated } = getKindeServerSession();
		const isUserAuthenticated = await isAuthenticated();
		const user = await getUser();

		if (!isUserAuthenticated || !user) {
			return NextResponse.json(
				{ success: false, message: "Unauthorized" },
				{ status: 401 }
			);
		}

		await dbConnect();

		const { generations, couponCode } = await req.json();

		// Validate input
		if (!generations || generations <= 0 || !couponCode) {
			return NextResponse.json(
				{ success: false, message: "Missing required fields" },
				{ status: 400 }
			);
		}

		// Find the coupon
		const coupon = await Coupon.findOne({ code: couponCode });

		if (!coupon) {
			return NextResponse.json(
				{ success: false, message: "Invalid coupon code" },
				{ status: 400 }
			);
		}

		if (!coupon.isValid()) {
			return NextResponse.json(
				{
					success: false,
					message: "Coupon has expired or reached usage limit",
				},
				{ status: 400 }
			);
		}
		const adminSettings = await AdminSettings.findOne();
		if (!adminSettings) {
			return NextResponse.json(
				{
					success: false,
					message: "Failed to fetch admin settings",
				},
				{ status: 500 }
			);
		}

		const { pricePerGeneration } = adminSettings;
		const pricing = await calculatePricing({
			generations,
			pricePerGeneration,
			couponCode,
		});

		return NextResponse.json({
			success: true,
			...pricing,
			message: "Coupon applied successfully",
		});
	} catch (error) {
		console.error("Coupon validation error:", error);
		return NextResponse.json(
			{
				success: false,
				message: "Failed to validate coupon",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
