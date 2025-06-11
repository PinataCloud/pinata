import { PinataSDK } from "pinata";

const pinata = new PinataSDK({
	pinataJwt: process.env.PINATA_JWT!,
	pinataGateway: "",
});

async function main() {
	try {
		// upload
		const file = new File(["Hello vectors 2.0!!!"], "hello-vectors.txt");
		const upload = await pinata.upload.private
			.file(file)
			.group("bfb65ae7-d9fe-4744-aa86-87f948b1df39")
			.vectorize();
		console.log(upload);

		// query vector
		const files = await pinata.files.private.queryVectors({
			groupId: "bfb65ae7-d9fe-4744-aa86-87f948b1df39",
			query: "vectors",
			returnFile: true,
		});
		console.log(files);
	} catch (error) {
		console.log(error);
	}
}

main();
