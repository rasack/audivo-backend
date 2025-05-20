import { NextRequest, NextResponse } from "next/server";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { BlobServiceClient } from "@azure/storage-blob";
import Prompt from "@/models/Prompt";

const sasToken = process.env.NEXT_PUBLIC_STORAGE_SASTOKEN;
const storageResourceName = process.env.NEXT_PUBLIC_STORAGERESOURCENAME!;

async function streamToArrayBuffer(
	readableStream: NodeJS.ReadableStream
): Promise<ArrayBuffer> {
	return new Promise((resolve, reject) => {
		const chunks: Uint8Array[] = [];
		readableStream.on("data", (chunk) => chunks.push(chunk));
		readableStream.on("end", () => {
			const buffer = Buffer.concat(chunks);
			resolve(
				buffer.buffer.slice(
					buffer.byteOffset,
					buffer.byteOffset + buffer.byteLength
				)
			);
		});
		readableStream.on("error", reject);
	});
}

async function verifyUserOwnership(
	userId: string,
	urls: string[]
): Promise<boolean> {
	try {
		const userPrompts = await Prompt.find({
			userId: userId,
			requestFile: { $in: urls },
			isDeleted: false,
			isActive: true,
		}).select("requestFile");

		const userUrls = new Set(
			userPrompts.flatMap((prompt) => prompt.requestFile)
		);

		// Check if all requested URLs are in the user's valid URLs
		const allUrlsOwned = urls.every((url) => userUrls.has(url));

		return allUrlsOwned;
	} catch (error) {
		console.error("Error verifying user ownership:", error);
		return false;
	}
}

export async function POST(req: NextRequest) {
	try {
		if (!sasToken) {
			return new NextResponse("SAS Token is not configured", { status: 500 });
		}

		const { isAuthenticated, getUser } = getKindeServerSession();
		const authenticated = await isAuthenticated();
		const user = await getUser();

		if (!authenticated || !user) {
			return new NextResponse("Unauthorized", { status: 401 });
		}

		const { urls } = await req.json();
		if (!Array.isArray(urls) || urls.length === 0) {
			return new NextResponse("Invalid or empty URL array", { status: 400 });
		}

		const userAllowed = await verifyUserOwnership(user.id, urls);
		if (!userAllowed) {
			return new NextResponse("Forbidden", { status: 403 });
		}

		const blobServiceClient = new BlobServiceClient(
			`https://${storageResourceName}.blob.core.windows.net/?${sasToken}`
		);

		const audioStreams = await Promise.all(
			urls.map(async (url) => {
				const urlObject = new URL(url);
				if (!urlObject.hostname.includes(storageResourceName)) {
					throw new Error("Invalid file URL");
				}

				const pathParts = urlObject.pathname.split("/");
				const containerName = pathParts[1];
				const blobName = pathParts.slice(2).join("/");

				const containerClient =
					blobServiceClient.getContainerClient(containerName);
				const blockBlobClient = containerClient.getBlockBlobClient(blobName);

				const properties = await blockBlobClient.getProperties();
				const contentType = properties.contentType;

				if (!contentType || !contentType.includes("audio/")) {
					throw new Error("The content is not an audio file");
				}

				const downloadResponse = await blockBlobClient.download(0);
				if (!downloadResponse.readableStreamBody) {
					throw new Error("Failed to download audio file");
				}

				const arrayBuffer = await streamToArrayBuffer(
					downloadResponse.readableStreamBody
				);

				return {
					url,
					arrayBuffer: Array.from(new Uint8Array(arrayBuffer)),
					contentType,
				};
			})
		);

		return NextResponse.json(audioStreams);
	} catch (error) {
		console.error("Batch audio streaming error:", error);
		return new NextResponse("Internal Server Error", { status: 500 });
	}
}
