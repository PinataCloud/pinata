import { PinataSDK } from "pinata";

const pinata = new PinataSDK({
	pinataJwt: process.env.PINATA_JWT!,
	pinataGateway: "",
});

async function main() {
	try {
		const uuid1 = crypto.randomUUID();
		const uuid2 = crypto.randomUUID();
		const file1 = new File([uuid1], `${uuid1}.txt`, {
			type: "text/plain",
		});
		const file2 = new File([uuid2], `${uuid2}.txt`, {
			type: "text/plain",
		});
		const data = await pinata.upload.public
			.fileArray([file1, file2])
			.name(uuid1)
			.keyvalues({
				test: uuid1,
			});
		console.log(data);
		const files = await pinata.files.public.list().name(uuid1);
		console.log(files.files);
	} catch (error) {
		console.log(error);
	}
}

main();
