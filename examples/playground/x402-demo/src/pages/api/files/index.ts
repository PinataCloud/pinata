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
    };

    const result = await pinata.files.public.list().limit(options.limit).pageToken(options.pageToken);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error listing files:', error);
    return new Response(JSON.stringify({ error: 'Failed to list files' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const name = formData.get('name') as string;
    const groupId = formData.get('groupId') as string;
    
    if (!file) {
      return new Response(JSON.stringify({ error: 'File is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const options: any = {};
    if (name) options.name = name;
    if (groupId) options.groupId = groupId;

    const result = await pinata.upload.public.file(file, options);
    
    return new Response(JSON.stringify(result), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return new Response(JSON.stringify({ error: 'Failed to upload file' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};