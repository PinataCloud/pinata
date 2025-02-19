import { type NextRequest, NextResponse } from "next/server";
import { pinata } from "@/utils/config";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, res: NextResponse) {
  try {
    const data = await req.json();
    console.log(pinata.config?.pinataGateway)
    const url = await pinata.gateways.private.createAccessLink({
      cid: data.cid,
      expires: 30,
    });
    return NextResponse.json(url, { status: 200 });
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { text: "Error creating API Key:" },
      { status: 500 },
    );
  }
}
