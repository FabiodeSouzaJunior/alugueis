import { createClient } from "@supabase/supabase-js";

import { getServiceRoleClient } from "@/database/supabaseClient";

function createPublicAuthClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error("Supabase keys nÃ£o configuradas");
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function isUserAlreadyExistsError(error) {
  const message = String(error?.message || "").toLowerCase();

  return (
    message.includes("already registered") ||
    message.includes("already exists") ||
    message.includes("user already") ||
    message.includes("duplicate")
  );
}

export async function resolveOrganizationIdByEmail(email) {
  const supabase = getServiceRoleClient();

  try {
    const { data: inviteRows, error: inviteError } = await supabase
      .from("invites")
      .select("organization_id,created_at")
      .ilike("email", email)
      .not("organization_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (inviteError) throw inviteError;
    if (Array.isArray(inviteRows) && inviteRows[0]?.organization_id) {
      return inviteRows[0].organization_id;
    }
  } catch (_) {
    // Fall through to organizations lookup.
  }

  try {
    const { data: organizationRows, error: organizationError } = await supabase
      .from("organizations")
      .select("id,created_at")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1);

    if (organizationError) throw organizationError;
    if (Array.isArray(organizationRows) && organizationRows[0]?.id) {
      return organizationRows[0].id;
    }
  } catch (_) {
    // Ignore and return null below.
  }

  return null;
}

export async function createUser(email, password) {
  const supabase = getServiceRoleClient();

  return supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
}

export async function checkUserExistsByEmail(email) {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.auth.admin.listUsers({
    filter: email,
    page: 1,
    perPage: 50,
  });
  if (error) return false;
  return (data?.users || []).some(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );
}

export async function upsertMembership(userId, organizationId) {
  const supabase = getServiceRoleClient();

  return supabase.from("memberships").upsert(
    {
      user_id: userId,
      organization_id: organizationId,
      role: "admin",
    },
    { onConflict: "user_id,organization_id" }
  );
}

export async function ensureOwnerAccessForUser({
  userId,
  organizationId,
  email,
} = {}) {
  if (!userId || !organizationId) {
    return {
      ownerId: null,
      createdOwner: false,
      linkedProperties: 0,
      error: null,
    };
  }

  const supabase = getServiceRoleClient();

  const { data: existingOwnerLink, error: ownerLinkError } = await supabase
    .from("owner_user_links")
    .select("owner_id")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (ownerLinkError && ownerLinkError.code !== "PGRST116") {
    return {
      ownerId: null,
      createdOwner: false,
      linkedProperties: 0,
      error: ownerLinkError,
    };
  }

  let ownerId = existingOwnerLink?.owner_id || null;
  let createdOwner = false;

  if (!ownerId) {
    const displayName = String(email || "Owner principal").trim().slice(0, 255) || "Owner principal";

    const { data: ownerProfile, error: ownerProfileError } = await supabase
      .from("owner_profiles")
      .insert({
        organization_id: organizationId,
        display_name: displayName,
        legal_name: displayName,
        status: "active",
        metadata: {
          createdVia: "auth_onboarding",
          bootstrappedFromEmail: email || null,
        },
      })
      .select("id")
      .maybeSingle();

    if (ownerProfileError) {
      return {
        ownerId: null,
        createdOwner: false,
        linkedProperties: 0,
        error: ownerProfileError,
      };
    }

    ownerId = ownerProfile?.id || null;
    createdOwner = true;
  }

  const { error: upsertOwnerUserLinkError } = await supabase
    .from("owner_user_links")
    .upsert(
      {
        organization_id: organizationId,
        owner_id: ownerId,
        user_id: userId,
        role: "owner_admin",
        active: true,
        metadata: {
          createdVia: "auth_onboarding",
        },
      },
      { onConflict: "owner_id,user_id" }
    );

  if (upsertOwnerUserLinkError) {
    return {
      ownerId,
      createdOwner,
      linkedProperties: 0,
      error: upsertOwnerUserLinkError,
    };
  }

  const { data: properties, error: propertiesError } = await supabase
    .from("properties")
    .select("id, organization_id")
    .eq("organization_id", organizationId);

  if (propertiesError) {
    return {
      ownerId,
      createdOwner,
      linkedProperties: 0,
      error: propertiesError,
    };
  }

  const propertyRows = Array.isArray(properties) ? properties : [];
  let linkedProperties = 0;

  if (propertyRows.length > 0) {
    const ownerPropertyPayload = propertyRows.map((property) => ({
      organization_id: property.organization_id,
      owner_id: ownerId,
      property_id: property.id,
      active: true,
      created_by_user_id: userId,
      metadata: {
        createdVia: "auth_onboarding",
      },
    }));

    const { error: ownerPropertyError } = await supabase
      .from("owner_property_links")
      .upsert(ownerPropertyPayload, { onConflict: "owner_id,property_id" });

    if (ownerPropertyError) {
      return {
        ownerId,
        createdOwner,
        linkedProperties: 0,
        error: ownerPropertyError,
      };
    }

    linkedProperties = ownerPropertyPayload.length;
  }

  return {
    ownerId,
    createdOwner,
    linkedProperties,
    error: null,
  };
}

export async function signInWithPassword(email, password) {
  const supabase = createPublicAuthClient();
  return supabase.auth.signInWithPassword({ email, password });
}

export async function sendPasswordResetEmail(email, redirectTo) {
  const supabase = createPublicAuthClient();
  return supabase.auth.resetPasswordForEmail(email, { redirectTo });
}

export async function resolveRecoverySession(accessToken, refreshToken) {
  const supabase = createPublicAuthClient();
  const sessionResult = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (sessionResult.error) {
    return {
      error: sessionResult.error,
      session: null,
      user: null,
      supabase,
    };
  }

  const userResult = await supabase.auth.getUser();

  return {
    error: userResult.error || null,
    session: sessionResult.data?.session || null,
    user: userResult.data?.user || null,
    supabase,
  };
}

export async function updatePasswordWithRecoverySession(accessToken, refreshToken, password) {
  const recoverySession = await resolveRecoverySession(accessToken, refreshToken);

  if (recoverySession.error || !recoverySession.user) {
    return {
      data: null,
      error: recoverySession.error || new Error("SessÃ£o de recuperaÃ§Ã£o invÃ¡lida"),
      user: null,
    };
  }

  const { data, error } = await recoverySession.supabase.auth.updateUser({
    password,
  });

  return {
    data,
    error,
    user: recoverySession.user,
  };
}
