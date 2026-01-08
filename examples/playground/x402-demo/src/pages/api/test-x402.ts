import type { APIRoute } from 'astro';
import { PinataSDK } from 'pinata';

export const prerender = false;

const pinata = new PinataSDK({
  pinataJwt: import.meta.env.PINATA_JWT,
});

export const GET: APIRoute = async () => {
  try {
    console.log('Testing x402 API availability...');
    
    // Test 1: Try to list existing payment instructions
    console.log('Test 1: Listing payment instructions...');
    const listResult = await pinata.x402.listPaymentInstructions({ limit: 1 });
    console.log('List result:', JSON.stringify(listResult, null, 2));
    
    return new Response(JSON.stringify({
      success: true,
      message: 'X402 API is working',
      listResult
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('X402 test failed:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'X402 test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};