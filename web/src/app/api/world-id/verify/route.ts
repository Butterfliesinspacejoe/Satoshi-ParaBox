import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { merkle_root, nullifier_hash, proof, credential_type, action, signal } = body;

    if (!merkle_root || !nullifier_hash || !proof || !credential_type) {
      return NextResponse.json(
        { error: 'Missing required proof parameters.' },
        { status: 400 }
      );
    }

    const appId = process.env.WORLD_ID_APP_ID || 'app_staging_satoshis_parabox';
    const verifyUrl = `https://developer.worldcoin.org/api/v2/verify/${appId}`;

    console.log(`World ID Verification: Verifying nullifier ${nullifier_hash} against ${appId} (Action: ${action || 'user-login'})`);

    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        merkle_root,
        nullifier_hash,
        proof,
        verification_level: credential_type, // 'orb' or 'device'
        action: action || process.env.WORLD_ID_ACTION || 'user-login',
        signal: signal || ''
      }),
    });

    const data = await response.json();
    console.log('World ID Verification Response:', data);

    if (response.ok) {
      return NextResponse.json({
        success: true,
        detail: 'Zero-Knowledge proof verified successfully.',
        data
      });
    } else {
      return NextResponse.json({
        success: false,
        error: data.code || 'verification_failed',
        message: data.detail || 'Failed to verify Zero-Knowledge proof.'
      }, { status: 400 });
    }
  } catch (error: any) {
    console.error('World ID verification API error:', error);
    return NextResponse.json({
      success: false,
      error: 'internal_error',
      message: error.message || 'Internal server error during verification.'
    }, { status: 500 });
  }
}
