import { pinata } from "@/app/utils/pinata";

export async function GET() {
  try {
    const url = await pinata.upload.public.createSignedURL({
      expires: 60
    })
    return Response.json({ data: url }, { status: 200 })
  } catch (error) {
    console.log(error)
    return Response.json({ error: error }, { status: 500 })
  }
}
