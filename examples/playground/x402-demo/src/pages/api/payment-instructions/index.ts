import type { APIRoute } from 'astro';
import { PinataSDK } from 'pinata';

export const prerender = false;

const pinata = new PinataSDK({
  pinataJwt: import.meta.env.PINATA_JWT,
});

export const GET: APIRoute = async ({ url }) => {
  try {
    const searchParams = new URLSearchParams(url.search);
    const options = {
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      pageToken: searchParams.get('pageToken') || undefined,
      cid: searchParams.get('cid') || undefined,
      name: searchParams.get('name') || undefined,
      id: searchParams.get('id') || undefined,
    };

    const result = await pinata.x402.listPaymentInstructions(options);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error listing payment instructions:', error);
    return new Response(JSON.stringify({ error: 'Failed to list payment instructions' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    
    if (!body.name || !body.payment_requirements || body.payment_requirements.length === 0) {
      return new Response(JSON.stringify({ error: 'Name and at least one payment requirement are required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const result = await pinata.x402.createPaymentInstruction(body);
    
    return new Response(JSON.stringify(result), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error creating payment instruction:', error);
    return new Response(JSON.stringify({ error: 'Failed to create payment instruction' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};