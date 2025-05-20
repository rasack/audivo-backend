import { NextRequest, NextResponse } from "next/server";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";

const sasToken = process.env.NEXT_PUBLIC_STORAGE_SASTOKEN;

export async function POST(req: NextRequest) {
	try {
		const { isAuthenticated } = getKindeServerSession();
		const authenticated = await isAuthenticated();

		if (!authenticated) {
			return new NextResponse("Unauthorized", { status: 401 });
		}

		const { url, filename } = await req.json();

		if (!url) {
			return new NextResponse("File URL is required", { status: 400 });
		}

		const secureUrl = `${url}${url.includes("?") ? "&" : "?"}${sasToken}`;

		const response = await fetch(secureUrl);

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const contentType = response.headers.get("Content-Type");
		if (!contentType || !contentType.includes("audio/")) {
			throw new Error("The content is not an audio file");
		}

		const blob = await response.blob();

		const headers = new Headers();
		headers.set("Content-Type", contentType);
		headers.set(
			"Content-Disposition",
			`attachment; filename="${filename}.wav"`
		);

		return new NextResponse(blob, { headers });
	} catch (error) {
		console.error("Download error:", error);
		return new NextResponse("Internal Server Error", { status: 500 });
	}
}
