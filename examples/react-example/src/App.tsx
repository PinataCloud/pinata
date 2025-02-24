import { useState } from "react";
import { pinata } from "./utils/config"
import { NetworkError } from "../../../dist"

function App() {
  const [selectedFile, setSelectedFile] = useState()<File>;

  const changeHandler = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(event.target?.files?.[0]);
  };

  const handleSubmission = async () => {
    try {
      const upload = await pinata.upload.public.file(selectedFile)
      console.log(upload);
    } catch (error) {
      const e = error as NetworkError
      console.log(e.details?.metadata)
    }
  };

  return (
    <>
      <label className="form-label"> Choose File</label>
      <input type="file" onChange={changeHandler} />
      <button onClick={handleSubmission}>Submit</button>
    </>
  );
}

export default App;
