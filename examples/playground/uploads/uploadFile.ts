import { PinataSDK } from "pinata";
const fs = require("fs");

const pinata = new PinataSDK({
	pinataJwt: process.env.PINATA_JWT!,
	pinataGateway: "",
});

async function main() {
	try {
		const uuid = crypto.randomUUID();
		const blob = new Blob([JSON.stringify({ text: uuid })]);
		const file = new File([blob], `${uuid}.json`, { type: "application/json" });
		const upload = await pinata.upload.public.file(file).keyvalues({
			env: "prod",
		});
		console.dir(upload, { depth: null });
	} catch (error) {
		console.log(error);
	}
}

main();
