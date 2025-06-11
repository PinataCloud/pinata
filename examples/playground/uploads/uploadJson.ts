import { PinataSDK } from "pinata";

const pinata = new PinataSDK({
	pinataJwt: process.env.PINATA_JWT!,
	pinataGateway: "",
});

async function main() {
	try {
		const upload = await pinata.upload.public.json({
			content: "Hello World!",
		});
		console.log(upload);
	} catch (error) {
		console.log(error);
	}
}

main();
