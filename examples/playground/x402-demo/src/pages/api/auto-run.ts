import type { APIRoute } from 'astro';
import { PinataSDK } from 'pinata';

export const prerender = false;

const pinata = new PinataSDK({
  pinataJwt: import.meta.env.PINATA_JWT,
});

export const POST: APIRoute = async () => {
  try {
    const steps: string[] = [];
    
    // Step 1: Create a unique test file
    const timestamp = Date.now();
    const testContent = `X402 Demo Test File
Generated at: ${new Date(timestamp).toISOString()}
Timestamp: ${timestamp}
Random ID: ${Math.random().toString(36).substring(7)}

This file was automatically generated to demonstrate the X402 Monetization API functionality.
It includes payment instructions and CID associations for testing purposes.`;

    const testFile = new File([testContent], `x402-demo-${timestamp}.txt`, {
      type: 'text/plain'
    });

    steps.push(`Created test file: x402-demo-${timestamp}.txt`);

    // Step 2: Upload the file
    const uploadResult = await pinata.upload.public.file(testFile, {
      name: `X402 Demo File ${timestamp}`
    });

    steps.push(`Uploaded file with CID: ${uploadResult.cid}`);

    // Step 3: Create payment instruction
    const paymentInstruction = {
      name: `Demo Payment ${timestamp}`,
      description: "Auto-generated payment instruction for demo",
      payment_requirements: [
        {
          asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
          pay_to: "0x941f29fddA2CB16649b70D1C28aA5933DBba6295",
          network: "base-sepolia",
          amount: "1000000",
          description: "Payment for demo content access"
        }
      ]
    };

    console.log('Creating payment instruction with payload:', JSON.stringify(paymentInstruction, null, 2));
    const instructionResult = await pinata.x402.createPaymentInstruction(paymentInstruction);
    
    steps.push(`Created payment instruction: ${instructionResult.data.id}`);

    // Step 4: Associate CID with payment instruction
    await pinata.x402.addCid(instructionResult.data.id, uploadResult.cid);
    
    steps.push(`Associated CID ${uploadResult.cid} with payment instruction`);

    // Step 5: Verify the association
    const cidList = await pinata.x402.listCids(instructionResult.data.id);
    
    steps.push(`Verified association - found ${cidList.data.cids.length} CID(s)`);

    const result = {
      success: true,
      timestamp,
      steps,
      data: {
        file: {
          id: uploadResult.id,
          cid: uploadResult.cid,
          name: uploadResult.name,
        },
        paymentInstruction: {
          id: instructionResult.data.id,
          name: instructionResult.data.name,
          version: instructionResult.data.version,
        },
        association: {
          cids: cidList.data.cids,
        }
      }
    };
    
    return new Response(JSON.stringify(result), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error in auto-run:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Auto-run failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};