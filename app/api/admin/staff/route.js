import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Create an isolated admin or anon client
function getAdminClient() {
  if (supabaseServiceKey) {
    return createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return null;
}

function getIsolatedAnonClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// GET: List all staff members
export async function GET() {
  try {
    const client = getAdminClient() || getIsolatedAnonClient();
    const { data, error } = await client
      .from('staff')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      // If table does not exist yet, return empty list gracefully
      return NextResponse.json({ staff: [], error: error.message }, { status: 200 });
    }

    return NextResponse.json({ staff: data || [] });
  } catch (err) {
    return NextResponse.json({ staff: [], error: err.message }, { status: 500 });
  }
}

// POST: Create a new staff account (Chef, Waiter, Cashier, Manager)
export async function POST(req) {
  try {
    const body = await req.json();
    const { name, email, password, role, phone } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Name, email, and password are required.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    const validRoles = ['chef', 'waiter', 'cashier', 'manager'];
    const staffRole = validRoles.includes(role) ? role : 'waiter';
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanPhone = phone?.trim() || null;

    let authUserId = null;
    let authCreated = false;

    // 1. Try with Supabase Service Role (Admin API - auto-confirms user without email confirmation)
    const adminClient = getAdminClient();
    if (adminClient) {
      const { data: adminUserData, error: adminUserError } =
        await adminClient.auth.admin.createUser({
          email: cleanEmail,
          password: password,
          email_confirm: true,
          user_metadata: {
            role: staffRole,
            full_name: cleanName,
            phone: cleanPhone,
          },
        });

      if (adminUserError) {
        return NextResponse.json({ error: adminUserError.message }, { status: 400 });
      }

      authUserId = adminUserData?.user?.id || null;
      authCreated = true;
    } else {
      // 2. Fallback: Isolated Anon client signUp (does not overwrite Admin session)
      const isolatedClient = getIsolatedAnonClient();
      const { data: signUpData, error: signUpError } = await isolatedClient.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          data: {
            role: staffRole,
            full_name: cleanName,
            phone: cleanPhone,
          },
        },
      });

      if (signUpError) {
        return NextResponse.json({ error: signUpError.message }, { status: 400 });
      }

      authUserId = signUpData?.user?.id || null;
      authCreated = true;
    }

    // 3. Save or update record in 'staff' table
    const dbClient = adminClient || getIsolatedAnonClient();
    let staffRecord = null;

    try {
      const { data: inserted, error: dbError } = await dbClient
        .from('staff')
        .insert({
          auth_user_id: authUserId,
          name: cleanName,
          email: cleanEmail,
          role: staffRole,
          phone: cleanPhone,
          active: true,
        })
        .select()
        .single();

      if (!dbError) {
        staffRecord = inserted;
      }
    } catch (e) {
      console.warn('Could not insert to staff table:', e);
    }

    return NextResponse.json({
      ok: true,
      message: `Account for ${cleanName} (${staffRole}) successfully created!`,
      staff: staffRecord || {
        id: Date.now(),
        auth_user_id: authUserId,
        name: cleanName,
        email: cleanEmail,
        role: staffRole,
        phone: cleanPhone,
        active: true,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

// DELETE: Delete staff member
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const authId = searchParams.get('auth_id');

    if (!id && !authId) {
      return NextResponse.json({ error: 'Missing staff id' }, { status: 400 });
    }

    const adminClient = getAdminClient();
    if (adminClient && authId) {
      await adminClient.auth.admin.deleteUser(authId);
    }

    const dbClient = adminClient || getIsolatedAnonClient();
    if (id) {
      await dbClient.from('staff').delete().eq('id', id);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH: Toggle active status
export async function PATCH(req) {
  try {
    const body = await req.json();
    const { id, active } = body;
    if (!id) return NextResponse.json({ error: 'Missing staff id' }, { status: 400 });

    const dbClient = getAdminClient() || getIsolatedAnonClient();
    const { data, error } = await dbClient
      .from('staff')
      .update({ active: !!active })
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, staff: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
