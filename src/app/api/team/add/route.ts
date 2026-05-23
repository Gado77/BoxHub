import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin client não configurado no servidor.' }, { status: 400 });
    }

    const { email, name, role, organization_id } = await request.json();

    if (!email || !name || !role || !organization_id) {
      return NextResponse.json({ error: 'Dados incompletos para criação de membro.' }, { status: 400 });
    }

    // Invite user via email using Supabase
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: `${appUrl}/welcome`,
        data: {
          full_name: name
        }
      }
    );

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!authData?.user) {
      return NextResponse.json({ error: 'Falha ao gerar convite para o usuário.' }, { status: 400 });
    }

    // Insert user into profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        organization_id,
        name,
        role
      });

    if (profileError) {
      // Clean up the created auth user if profile creation failed to avoid orphans
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      member: {
        id: authData.user.id,
        organization_id,
        name,
        role
      }
    });

  } catch (err: any) {
    console.error('Erro na API de convite de equipe:', err);
    return NextResponse.json({ error: err.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}
