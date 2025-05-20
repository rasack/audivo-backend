import { NextResponse } from 'next/server';
import dbConnect from "@/lib/database/mongo";
import Prompt from '@/models/Prompt';
import axios from 'axios';

async function isAudioLinkValid(url: string): Promise<boolean> {
    try {
        const response = await axios.head(url);
        return response.status === 200;
    } catch (error) {
        return false;
    }
}

export async function GET() {
    try {
        await dbConnect();

        // await Prompt.updateMany(
        //     { isValid: { $exists: false } },
        //     { $set: { isValid: true } }
        // );

        // const prompts = await Prompt.find({
        // });
        // await Promise.all(
        //     prompts.map(async (prompt) => {
        //         if (!prompt.responseFile?.length) {
        //             await Prompt.updateOne(
        //                 { _id: prompt._id },
        //                 { $set:  { isValid: false } },
        //             );
        //             console.warn(`⚠️ Skipping prompt ${prompt.promptId} due to empty requestFile`);
        //             return;
        //         }

        //         try {
        //             const fileUrl = prompt.responseFile[0] + "?" + process.env.NEXT_PUBLIC_STORAGE_SASTOKEN;
        //             const isValid = await isAudioLinkValid(fileUrl);
                    
        //             await Prompt.updateOne(
        //                 { _id: prompt._id },
        //                 { $set: { isValid } }
        //             );
        //         } catch (err) {
        //             console.error(` Error validating URL for prompt ${prompt._id}:`, err);
        //         }
        //     })
        // );

        return NextResponse.json({ message: 'Invalid links updated successfully' }, { status: 200 });
    } catch (error) {
        console.error(' Error updating invalid links:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
