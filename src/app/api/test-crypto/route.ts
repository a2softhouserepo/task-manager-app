import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Client from '@/models/Client';
import { encryptString, decryptString } from '@/lib/crypto';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    // 1. Test direct crypto functions
    const original = 'test-crypto-' + Date.now();
    const encrypted = encryptString(original);
    const decrypted = decryptString(encrypted);
    
    const directTest = {
      original,
      encrypted,
      decrypted,
      match: original === decrypted
    };

    // 2. Test Model creation
    const testEmail = `test-${Date.now()}@example.com`;
    const client = await Client.create({
      name: 'Test Crypto Client',
      email: testEmail,
      active: true,
      createdBy: 'test-script'
    });

    // 3. Fetch back
    const fetchedClient = await Client.findById(client._id);
    
    // Check raw document in DB (if possible, but we are using Mongoose which decrypts on load)
    // To check raw, we can use .collection.findOne
    const rawDoc = await Client.collection.findOne({ _id: client._id });

    return NextResponse.json({
      directTest,
      modelTest: {
        id: client._id,
        originalEmail: testEmail,
        fetchedEmail: fetchedClient?.email,
        rawEmail: rawDoc?.email, // Should be encrypted
        isRawEncrypted: rawDoc?.email?.startsWith('enc:v1:'),
        match: fetchedClient?.email === testEmail
      }
    });

  } catch (error: any) {
    console.error('Test failed:', error);
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}
