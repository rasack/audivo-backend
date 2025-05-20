import { NextRequest, NextResponse } from "next/server";

const sasToken = process.env.NEXT_PUBLIC_SAS_TOKEN;

export async function POST(req: NextRequest) {
	try {
		if (!sasToken) {
			return new NextResponse("SAS Token is not configured", { status: 500 });
		}

		const { url } = await req.json();

		if (!url) {
			return new NextResponse("URL is required", { status: 400 });
		}

		const parsedUrl = new URL(url);

		// Remove any existing query parameters
		parsedUrl.search = "";

		const urlWithSasToken = `${parsedUrl.toString()}?${sasToken}`;

		return NextResponse.json({ url: urlWithSasToken });
	} catch (error) {
		console.error("Error appending SAS token:", error);
		return new NextResponse("Internal Server Error", { status: 500 });
	}
}
