import { type NextRequest, NextResponse } from "next/server";
import { pinata } from "@/utils/config";
import { KeyResponse } from "../../../../../dist";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, res: NextResponse) {
  try {
    const uuid = crypto.randomUUID();
    const keyData: KeyResponse = await pinata.keys.create({
      keyName: uuid.toString(),
      permissions: {
        endpoints: {
          pinning: {
            pinFileToIPFS: true,
          },
        },
      },
      maxUses: 1,
    });
    return NextResponse.json(keyData, { status: 200 });
  } catch (error) {
    console.log(error);
    return NextResponse.json({ text: "Error creating API Key:" }, { status: 500 });
  }
}
