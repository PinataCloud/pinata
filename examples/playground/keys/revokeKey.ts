import { PinataSDK } from "pinata";

const pinata = new PinataSDK({
	pinataJwt: process.env.PINATA_JWT!,
	pinataGateway: "",
});

async function main() {
	try {
		const keys = await pinata.keys.revoke(["94566af5e63833e260be"]);
		console.log(keys);
	} catch (error) {
		console.log(error);
	}
}

await main();
