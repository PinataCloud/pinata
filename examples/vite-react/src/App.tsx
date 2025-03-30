import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import pinataLogo from '/pinnie.png'
import './App.css'
import { PinataSDK } from 'pinata'

const pinata = new PinataSDK({
  pinataJwt: "",
  pinataGateway: import.meta.env.VITE_GATEWAY_URL
})

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState('')
  const [link, setLink] = useState('')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!file) return

    try {
      setUploadStatus('Getting upload URL...')
      const urlResponse = await fetch(`${import.meta.env.VITE_SERVER_URL}/upload_url`, {
        method: "GET",
        headers: {
          // Handle authorization here
        }
      })
      const data = await urlResponse.json()

      setUploadStatus('Uploading file...')

      const upload = await pinata.upload.public
        .file(file)
        .url(data.url)

      if (upload.cid) {
        setUploadStatus('File uploaded successfully!')
        const ipfsLink = await pinata.gateways.public.convert(upload.cid)
        setLink(ipfsLink)
      } else {
        setUploadStatus('Upload failed')
      }
    } catch (error) {
      setUploadStatus(`Error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
        <a href="https://pinata.cloud" target="_blank">
          <img src={pinataLogo} className="logo pinata" alt="Pinata logo" />
        </a>
      </div>
      <h1>Vite + React + Pinata</h1>
      <div className="card">
        <input type="file" onChange={handleFileChange} />
        <button onClick={handleUpload} disabled={!file}>
          Upload to Pinata
        </button>
        {uploadStatus && <p>{uploadStatus}</p>}
        {link && <a href={link} target='_blank'>View File</a>}
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
