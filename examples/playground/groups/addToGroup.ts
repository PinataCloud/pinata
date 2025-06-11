import { PinataSDK } from "pinata";
import * as crypto from "crypto";

const pinata = new PinataSDK({
	pinataJwt: process.env.PINATA_JWT!,
	pinataGateway: "",
});

async function main() {
	try {
		const uuid = crypto.randomUUID();
		const file = new File([uuid], `${uuid}.txt`, { type: "text/plain" });
		const signedUrl = await pinata.upload.private.createSignedURL({
			expires: 100,
			groupId: "d28a73ce-e54e-433e-896a-21b2e720d05a",
		});
		console.log(signedUrl);
		const upload = await pinata.upload.private.file(file).url(signedUrl);
		console.log(upload);
	} catch (error) {
		console.log(error);
	}
}

main();
