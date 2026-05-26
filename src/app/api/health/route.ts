import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = await createClient();
    let dbStatus = 'disconnected';

    if (supabase) {
      // Testar uma consulta simples para verificar conectividade do banco
      const { error } = await supabase.from('profiles').select('id').limit(1);
      if (!error) {
        dbStatus = 'connected';
      } else {
        dbStatus = `error: ${error.message}`;
      }
    } else {
      dbStatus = 'mock-mode';
    }

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      env: {
        node: process.env.NODE_ENV,
        hasStripe: !!process.env.STRIPE_SECRET_KEY,
        hasClaude: !!process.env.ANTHROPIC_API_KEY
      }
    });
  } catch (err: any) {
    return NextResponse.json({
      status: 'unhealthy',
      error: err.message
    }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
