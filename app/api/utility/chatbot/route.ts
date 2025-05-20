// import {
// 	OpenAIClient,
// 	AzureKeyCredential,
// 	ChatResponseMessage,
// } from "@azure/openai";
// import { OpenAIStream, StreamingTextResponse } from "ai";
import { NextResponse } from "next/server";

// import { getMsg } from "@/lib/chatbotlib";

// const template =
// 	"Assume you are a Music Theorists / Music Producer, write a detailed prompt for a musical composition with the characteristic which include Key and Scale, Mood and Emotion, Melodic Elements, Harmonic Structure, Rhythmic Elements, Dynamic Range, Instrumentation and Orchestration, Climax and Resolution and Overall Structure.Example: Begin with a clear and strong theme to establish the key and mood. Develop this theme with increasing complexity, incorporating variations and building tension. Lead into the crescendo, culminating in a climax that resolves into the Gmaj9 chord for a satisfying conclusion. The piece should be in G major. The music should evoke a triumphant and cinematic feel, characterized by strong, bold, and uplifting tones. The melody should be clear and prominent, with motifs that are both memorable and inspiring. Utilize rich, major chords throughout, building towards a Gmaj9 chord resolution to add depth and complexity. The rhythm should be energetic and driving, with a steady beat that propels the music forward. Include specific rhythmic patterns or time signatures as needed to enhance this effect. The piece should start at a moderate volume and gradually build in intensity, leading to a crescendo that reaches a powerful and emotional climax. The composition should feature a full orchestra, with brass and strings playing prominent roles. The brass should contribute to the bold and triumphant sound, while the strings provide both warmth and intensity. Structure the music to build towards a climax through a crescendo. The climax should resolve into a Gmaj9 chord, emphasizing the 9th (A note) to create a sophisticated and triumphant finish.It should be combined in a given sentence with less than 50 words";

export async function POST(req: Request) {
return NextResponse.json({ error: "Missing required fields: video and prompt" }, { status: 400 });
// 	const body = await req.json();
	// const body = await req.json();
	// const { prompt } = body;

	// const response = await getMsg(template, prompt);
	// const trim = response.substring(9);

	// const userMsg: ChatResponseMessage = {
	// 	role: "ChatBot😊",
	// 	content: trim,
	// };
	// return NextResponse.json(userMsg);
}
