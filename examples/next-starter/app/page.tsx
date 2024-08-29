"use client";

import { useState, useRef } from "react";
import { pinata } from "@/utils/config";

export default function Home() {
	const [file, setFile]: any = useState();
	const [cid, setCid] = useState("");
	const [uploading, setUploading] = useState(false);

	const inputFile = useRef(null);

	const uploadFile = async () => {
		try {
			setUploading(true);
			const keyRequest = await fetch("/api/key");
			const keyData = await keyRequest.json();
			const upload = await pinata.upload.file(file).key(keyData.JWT);
			setCid(upload.cid);
			setUploading(false);
		} catch (e) {
			console.log(e);
			setUploading(false);
			alert("Trouble uploading file");
		}
	};

	const handleChange = (e) => {
		setFile(e.target.files[0]);
	};

	return (
		<main className="w-full min-h-screen m-auto flex flex-col justify-center items-center">
			<input type="file" id="file" ref={inputFile} onChange={handleChange} />
			<button disabled={uploading} onClick={uploadFile}>
				{uploading ? "Uploading..." : "Upload"}
			</button>
			{cid && (
				<img
					src={`https://${process.env.NEXT_PUBLIC_GATEWAY_URL}/ipfs/${cid}`}
					alt="Image from IPFS"
				/>
			)}
		</main>
	);
}
