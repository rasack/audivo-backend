import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { prompt } = await req.json();
        if (!prompt) {
            return NextResponse.json({ error: 'Query is required' }, { status: 400 });
        }
        const query=`hello open ai I have made a site which make music through prompts so if a user use i want to ask them the issue in the music so i will give you a prompt what they type according to prompt you give me 5 major isuues dont include otherthn anything i just want issues 5 only nothing else prompt:${prompt} if prompt is not clear then give any probable issues remove indexing 1,2,3,4,5 always 5 anyhow and in different lines even if the prompt is vague only one line space no double .it gove only tunes so issues according to tune only not lyrics. /n`; 
        const response = await fetch(`${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=2023-07-01-preview`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': process.env.AZURE_OPENAI_API_KEY as string, 
            },
            body: JSON.stringify({
                messages: [{ role: 'user', content: query }],
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const error = await response.json();
            return NextResponse.json({ error }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data.choices[0].message.content);
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
