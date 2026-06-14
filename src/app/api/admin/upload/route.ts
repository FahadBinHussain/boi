import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error: 'Upload endpoint removed',
      details: 'Files.vc integration has been removed. Use direct PDF URLs instead.'
    },
    { status: 410 }
  );
}
