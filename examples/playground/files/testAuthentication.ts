import { PinataSDK } from "pinata";

const pinata = new PinataSDK({
	pinataJwt: `fdsafsdf`,
	pinataGateway: "",
});

async function main() {
	try {
		const data = await pinata.testAuthentication();
		console.log(data);
	} catch (error) {
		console.log(error);
	}
}

main();
