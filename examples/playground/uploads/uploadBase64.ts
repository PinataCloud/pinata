import { PinataSDK } from "pinata";

const pinata = new PinataSDK({
	pinataJwt: process.env.PINATA_JWT!,
	pinataGateway: "",
});

async function main() {
	try {
		const data = await pinata.upload.public.base64("SGVsbG8gV29ybGQh");
		console.log(data);
	} catch (error) {
		console.log(error);
	}
}

await main();
