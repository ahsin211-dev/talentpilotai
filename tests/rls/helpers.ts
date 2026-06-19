/**
 * Test helpers for exercising RLS exactly as Supabase would at runtime.
 *
 * On Supabase, PostgREST runs every request as the `authenticated` (or `anon`)
 * role and injects the user's JWT claims into the `request.jwt.claims` GUC, so
 * `auth.uid()` resolves to the `sub` claim. We reproduce that precisely here:
 *   - `actAs(client, authUserId)`  -> SET ROLE authenticated + JWT sub claim
 *   - `actAsServiceRole(client)`   -> SET ROLE service_role (BYPASSRLS)
 *   - `actAsAnon(client)`          -> SET ROLE anon
 * Fixtures are seeded as the superuser (which bypasses RLS), mirroring how the
 * service-role key seeds data on the server.
 */
import { Client } from "pg";

export const TEST_DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://ubuntu@/talentpilot?host=/var/run/postgresql";

export async function connect(): Promise<Client> {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  return client;
}

/** Reset to the superuser identity with no JWT claims. */
export async function actAsSuperuser(client: Client): Promise<void> {
  await client.query("reset role");
  await client.query("select set_config('request.jwt.claims', '', false)");
}

/** Impersonate an authenticated end-user (candidate / employer / admin). */
export async function actAs(client: Client, authUserId: string): Promise<void> {
  await client.query("reset role");
  await client.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ sub: authUserId, role: "authenticated" }),
  ]);
  await client.query("set role authenticated");
}

/** Impersonate the trusted server identity (service-role key). */
export async function actAsServiceRole(client: Client): Promise<void> {
  await client.query("reset role");
  await client.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ role: "service_role" }),
  ]);
  await client.query("set role service_role");
}

/** Impersonate an anonymous (logged-out) visitor. */
export async function actAsAnon(client: Client): Promise<void> {
  await client.query("reset role");
  await client.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ role: "anon" }),
  ]);
  await client.query("set role anon");
}

export type Fixtures = Awaited<ReturnType<typeof seedFixtures>>;

/**
 * Seed a deterministic world (run as superuser):
 *   - candidate A & B (each: private details, published+approved profile, docs)
 *   - employer 1 (active subscription) & employer 2 (no subscription)
 *   - admin reviewer (role=reviewer) & admin super (role=super_admin)
 *   - an AI extraction result with raw output for candidate A
 */
export async function seedFixtures(client: Client) {
  await actAsSuperuser(client);

  const authUser = async (email: string): Promise<string> => {
    const r = await client.query(
      "insert into auth.users (email) values ($1) returning id",
      [email],
    );
    return r.rows[0].id as string;
  };

  // --- auth users ---
  const candAuthA = await authUser("cand-a@example.com");
  const candAuthB = await authUser("cand-b@example.com");
  const empAuth1 = await authUser("emp1@example.com");
  const empAuth2 = await authUser("emp2@example.com");
  const adminAuthReviewer = await authUser("reviewer@example.com");
  const adminAuthSuper = await authUser("super@example.com");

  // --- admins ---
  const adminReviewer = (
    await client.query(
      "insert into public.admin_users (auth_user_id, full_name, role) values ($1,$2,'reviewer') returning id",
      [adminAuthReviewer, "Reviewer One"],
    )
  ).rows[0].id as string;
  const adminSuper = (
    await client.query(
      "insert into public.admin_users (auth_user_id, full_name, role) values ($1,$2,'super_admin') returning id",
      [adminAuthSuper, "Super Admin"],
    )
  ).rows[0].id as string;

  // --- candidates ---
  const mkCandidate = async (authId: string, surname: string) => {
    const candId = (
      await client.query(
        "insert into public.candidates (auth_user_id, status, current_stage) values ($1,'profile_published','profile_published') returning id",
        [authId],
      )
    ).rows[0].id as string;
    await client.query(
      `insert into public.candidate_private_details
        (candidate_id, first_name, last_name, email, phone, passport_number, city, state, country)
       values ($1,$2,$3,$4,$5,$6,'Sydney','NSW','Philippines')`,
      [candId, "John", surname, `${surname.toLowerCase()}@example.com`, "+61400000000", "P1234567"],
    );
    const profileId = (
      await client.query(
        `insert into public.candidate_profiles_public_redacted
          (candidate_id, display_name, headline, summary, occupation_title, skills,
           years_experience, country_of_origin, availability, visa_stage,
           redaction_status, is_published, approved_by, approved_at)
         values ($1,$2,'Skilled tradesperson','Redacted summary','Carpenter',
           array['framing','formwork'],8,'Philippines','Immediate','Subclass 482 eligible',
           'approved', true, $3, now()) returning id`,
        [candId, `John ${surname[0]}.`, adminSuper],
      )
    ).rows[0].id as string;
    const docId = (
      await client.query(
        `insert into public.candidate_documents
          (candidate_id, document_type, access_tier, s3_bucket, s3_key, file_name, mime_type, file_size_bytes)
         values ($1,'cv','private','bucket','key/${candId}.pdf','cv.pdf','application/pdf',1024) returning id`,
        [candId],
      )
    ).rows[0].id as string;
    return { candId, profileId, docId };
  };

  const candidateA = await mkCandidate(candAuthA, "Smith");
  const candidateB = await mkCandidate(candAuthB, "Jones");

  // Raw AI output for candidate A (must never reach employers).
  await client.query(
    `insert into public.ai_extraction_results
       (candidate_id, document_id, model, raw_output, redacted_output, confidence_score, review_status)
     values ($1,$2,'claude-3-5-sonnet', $3::jsonb, $4::jsonb, 0.91, 'pending')`,
    [
      candidateA.candId,
      candidateA.docId,
      JSON.stringify({ surname: "Smith", phone: "+61400000000", passport: "P1234567" }),
      JSON.stringify({ display_name: "John S." }),
    ],
  );

  // --- employers ---
  const emp1 = (
    await client.query(
      "insert into public.employer_accounts (auth_user_id, company_name, subscription_status) values ($1,'BuildCo','active') returning id",
      [empAuth1],
    )
  ).rows[0].id as string;
  const emp2 = (
    await client.query(
      "insert into public.employer_accounts (auth_user_id, company_name, subscription_status) values ($1,'NoSubCo','incomplete') returning id",
      [empAuth2],
    )
  ).rows[0].id as string;

  await client.query(
    "insert into public.subscriptions (employer_id, status, stripe_subscription_id) values ($1,'active','sub_test_1')",
    [emp1],
  );

  return {
    candAuthA,
    candAuthB,
    empAuth1,
    empAuth2,
    adminAuthReviewer,
    adminAuthSuper,
    adminReviewer,
    adminSuper,
    candidateA,
    candidateB,
    emp1,
    emp2,
  };
}

/** Assert that an async DB call is rejected (RLS WITH CHECK / RAISE). */
export async function expectRejected(
  fn: () => Promise<unknown>,
  contains?: string,
): Promise<void> {
  let threw = false;
  try {
    await fn();
  } catch (err) {
    threw = true;
    if (contains) {
      const msg = (err as Error).message || "";
      if (!msg.toLowerCase().includes(contains.toLowerCase())) {
        throw new Error(`expected error containing "${contains}", got: ${msg}`);
      }
    }
  }
  if (!threw) throw new Error("expected operation to be rejected, but it succeeded");
}
