import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const {
      merkle_root,
      nullifier_hash,
      proof,
      verification_level,
      credential_type,
      action,
      signal
    } = body;

    const rpId = process.env.WORLD_ID_RP_ID || 'rp_b12bc3aeda593eae';
    const isProduction = process.env.WORLD_ID_ENVIRONMENT === 'production';
    const baseUrl = isProduction
      ? 'https://developer.world.org'
      : 'https://staging-developer.worldcoin.org';
    const verifyUrl = `${baseUrl}/api/v4/verify/${rpId}`;

    console.log(`World ID Verification: Verifying ZK proof against v4 API (${isProduction ? 'Production' : 'Staging'}) for RP ID: ${rpId}`);

    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        merkle_root,
        nullifier_hash,
        proof,
        verification_level: verification_level || credential_type || 'orb',
        action: action || process.env.WORLD_ID_ACTION || 'user-login',
        signal: signal || ''
      }),
    });

    const data = await response.json();
    console.log('World ID v4 Verification Response:', data);

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
      }, { status: response.status || 400 });
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
