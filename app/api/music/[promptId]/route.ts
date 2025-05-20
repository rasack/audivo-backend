import dbConnect from "@/lib/database/mongo";
import Prompt from "@/models/Prompt";

export async function PUT(
	req: Request,
	{ params }: { params: { promptId: string } }
) {
	try {
		await dbConnect();
		const { action } = await req.json();

		if (action === "play") {
			await Prompt.findOneAndUpdate(
				{ promptId: params.promptId },
				{ $inc: { playCount: 1 } }
			);
		} else if (action === "download") {
			await Prompt.findOneAndUpdate(
				{ promptId: params.promptId },
				{ $inc: { downloadCount: 1 } }
			);
		}

		return new Response(JSON.stringify({ success: true }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		console.error("Error updating count:", error);
		return new Response(JSON.stringify({ error: "Internal Server Error" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}
