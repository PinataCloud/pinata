import { PinataSDK } from "pinata";
import fs from "fs";

const pinata = new PinataSDK({
	pinataJwt: process.env.PINATA_JWT,
	pinataGateway: "",
});

async function main() {
	try {
		const blob = new Blob([fs.readFileSync("/path/to/file")]);
		const file = new File([blob], "docs.mp4");

		const url = await pinata.upload.public.createSignedURL({
			expires: 3600,
		});
		console.log(url);

		const upload = await pinata.upload.public.file(file).url(url);
		console.log(upload);
	} catch (error) {
		console.log(error);
	}
}

main();
