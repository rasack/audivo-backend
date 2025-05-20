import { NextRequest, NextResponse } from "next/server";
import { Cashfree } from "cashfree-pg";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import dbConnect from "@/lib/database/mongo";
import Order, { OrderCreation } from "@/models/Order";
import User from "@/models/User";
import AdminSettings from "@/models/AdminSettings";
import Coupon from "@/models/Coupon";
import { calculatePricing } from "@/lib/pricing";
import { startSession } from "mongoose";
import { AxiosError } from "axios";

export async function POST(req: NextRequest) {
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

	const existingUser = await User.findOne({ user: user.id });
	if (!existingUser) {
		return NextResponse.json(
			{ success: false, error: "User not found" }   ,
			{ status: 404 }
		);
	}

	const { generations, couponCode, orderNote } = await req.json();

	if (!generations || generations <= 0) {
		return NextResponse.json(
			{ success: false, error: "Invalid generations count" },
			{ status: 400 }
		);
	}

	const adminSettings = await AdminSettings.findOne();
	if (!adminSettings) {
		return NextResponse.json(
			{
				success: false,
				error: "Failed to fetch admin settings",
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

	const orderId = `order_${Date.now()}`;

	const session = await startSession();
	session.startTransaction();

	try {
		Cashfree.XClientId = process.env.NEXT_PUBLIC_CASHFREE_APP_ID!;
		Cashfree.XClientSecret = process.env.CASHFREE_SECRET_KEY!;
		Cashfree.XEnvironment =
			process.env.NEXT_PUBLIC_CASHFREE_ENVIRONMENT === "SANDBOX"
				? Cashfree.Environment.SANDBOX
				: Cashfree.Environment.PRODUCTION;

		const request = {
			order_amount: pricing.finalPrice,
			order_currency: "INR",
			order_id: orderId,
			customer_details: {
				customer_id: user.id,
				customer_name: user.given_name ?? undefined,
				customer_email: user.email ?? undefined,
				customer_phone: existingUser.phNo ? String(existingUser.phNo) : "+919090407368",
			},
			order_meta: {
				return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/settings?order_id=${orderId}`,
				notify_url: `${process.env.NEXT_PUBLIC_CASHFREE_WEBHOOK_ENDPOINT}/api/payments/webhook`,
			},
			order_note: orderNote,
		};

		const response = await Cashfree.PGCreateOrder("2023-08-01", request);

		if (!response.data || !response.data.payment_session_id) {
			console.error("Missing payment session ID:", response.data);
			throw new Error("Failed to create Cashfree order");
		}

		const newOrder = new Order<OrderCreation>({
			orderId: response.data.order_id,
			amount: pricing.finalPrice,
			originalAmount: pricing.totalPrice,
			currency: "INR",
			userId: user.id,
			status: "PENDING",
			paymentSessionId: response.data.payment_session_id,
			orderNote,
			planDetails: {
				generations,
			},
			couponCode: couponCode,
			discountAmount: pricing.discountAmount,
		});

		await newOrder.save({ session });

		await session.commitTransaction();
		session.endSession();

		return NextResponse.json({
			success: true,
			message: "Order created successfully",
			data: {
				payment_session_id: response.data.payment_session_id,
				order_id: orderId,
				pricing: {
					basePrice: pricing.pricePerGeneration,
					totalPrice: pricing.totalPrice,
					discountAmount: pricing.discountAmount,
					finalPrice: pricing.finalPrice,
				},
			},
		});
	} catch (error) {
		await session.abortTransaction();
		session.endSession();
		console.error(
			"Error during order creation:",
			JSON.stringify(error, null, 2)
		);
		return NextResponse.json(
			{
				success: false,
				error:
					error instanceof AxiosError
						? error.response?.data?.message || error.message
						: "Order creation failed",
			},
			{ status: 500 }
		);
	}
}
