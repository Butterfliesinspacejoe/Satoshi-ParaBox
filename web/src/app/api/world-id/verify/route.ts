import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Support either forwarding the raw response object, or extracting fields
    const idkitResponse = body.idkitResponse || body;
    const rpId = body.rp_id || process.env.WORLD_ID_APP_ID || 'app_57d38506bb2953dc8219d826cd3dedd6';

    const isProduction = process.env.WORLD_ID_ENVIRONMENT === 'production';
    const verifyUrl = isProduction
      ? `https://developer.world.org/api/v4/verify/${rpId}`
      : `https://staging-developer.worldcoin.org/api/v4/verify/${rpId}`;

    console.log(`World ID Verification: Verifying ZK proof against v4 API (${isProduction ? 'Production' : 'Staging'}) for RP ID: ${rpId}`);

    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(idkitResponse),
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
