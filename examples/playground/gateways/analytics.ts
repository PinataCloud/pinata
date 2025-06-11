import { PinataSDK } from "pinata";

const pinata = new PinataSDK({
	pinataJwt: process.env.PINATA_JWT!,
	pinataGateway: "",
});

async function main() {
	try {
		const clicks = await pinata.analytics.requests.days(7).referer().limit(5);
		console.log(clicks);
	} catch (error) {
		console.log(error);
	}
}

main();
