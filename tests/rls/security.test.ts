/**
 * RLS / sensitive-access security test-suite.
 *
 * These tests are the executable proof of the platform's acceptance criteria.
 * They run the real migrations against a real PostgreSQL instance and exercise
 * the policies as candidate / employer / admin / anon / service-role identities.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { Client } from "pg";
import { applyAll } from "../../scripts/db-apply.ts";
import {
  connect,
  seedFixtures,
  actAs,
  actAsAnon,
  actAsServiceRole,
  actAsSuperuser,
  expectRejected,
  type Fixtures,
} from "./helpers.ts";

let client: Client;
let fx: Fixtures;

before(async () => {
  await applyAll(undefined, { reset: true });
  client = await connect();
  fx = await seedFixtures(client);
});

after(async () => {
  if (client) await client.end();
});

describe("Employer ↔ private candidate data isolation", () => {
  test("employer CANNOT read candidate_private_details (surname/phone/email/passport)", async () => {
    await actAs(client, fx.empAuth1);
    const res = await client.query("select * from public.candidate_private_details");
    assert.equal(res.rowCount, 0, "employer must see zero private detail rows");
  });

  test("employer CANNOT read candidate_documents (raw uploads)", async () => {
    await actAs(client, fx.empAuth1);
    const res = await client.query("select * from public.candidate_documents");
    assert.equal(res.rowCount, 0);
  });

  test("employer CANNOT read ai_extraction_results (raw AI output)", async () => {
    await actAs(client, fx.empAuth1);
    const res = await client.query("select * from public.ai_extraction_results");
    assert.equal(res.rowCount, 0);
  });

  test("employer CANNOT read the candidates anchor table", async () => {
    await actAs(client, fx.empAuth1);
    const res = await client.query("select * from public.candidates");
    assert.equal(res.rowCount, 0);
  });

  test("employer CANNOT self-grant a contact approval (insert blocked by RLS)", async () => {
    await actAs(client, fx.empAuth1);
    await expectRejected(() =>
      client.query(
        "insert into public.candidate_contact_approvals (candidate_id, employer_id, approved, approved_at) values ($1,$2,true,now())",
        [fx.candidateA.candId, fx.emp1],
      ),
    );
  });
});

describe("Employer redacted-profile browsing + subscription gate", () => {
  test("subscribed employer SEES published + approved redacted profiles", async () => {
    await actAs(client, fx.empAuth1);
    const res = await client.query(
      "select * from public.candidate_profiles_public_redacted",
    );
    assert.ok(res.rowCount && res.rowCount >= 2, "should see both published profiles");
    // Redacted surface carries no PII columns at all.
    for (const row of res.rows) {
      assert.ok(!("last_name" in row));
      assert.ok(!("phone" in row));
      assert.ok(!("email" in row));
      assert.ok(!("passport_number" in row));
    }
  });

  test("employer WITHOUT active subscription sees NO profiles (Stripe DB gate)", async () => {
    await actAs(client, fx.empAuth2);
    const res = await client.query(
      "select * from public.candidate_profiles_public_redacted",
    );
    assert.equal(res.rowCount, 0);
  });

  test("employer CANNOT see unpublished / unapproved profiles", async () => {
    // Create an unpublished profile as superuser.
    await actAsSuperuser(client);
    const au = (
      await client.query(
        "insert into auth.users (email) values ('draft@example.com') returning id",
      )
    ).rows[0].id;
    const cand = (
      await client.query(
        "insert into public.candidates (auth_user_id) values ($1) returning id",
        [au],
      )
    ).rows[0].id;
    await client.query(
      `insert into public.candidate_profiles_public_redacted
        (candidate_id, display_name, redaction_status, is_published)
       values ($1,'Draft D.','pending',false)`,
      [cand],
    );

    await actAs(client, fx.empAuth1);
    const res = await client.query(
      "select * from public.candidate_profiles_public_redacted where candidate_id = $1",
      [cand],
    );
    assert.equal(res.rowCount, 0, "draft profile must be invisible to employers");
  });

  test("subscription-gated: unsubscribed employer cannot create unlock request or favourite", async () => {
    await actAs(client, fx.empAuth2);
    await expectRejected(() =>
      client.query(
        "insert into public.contact_unlock_requests (employer_id, candidate_id) values ($1,$2)",
        [fx.emp2, fx.candidateA.candId],
      ),
    );
    await expectRejected(() =>
      client.query(
        "insert into public.employer_favourites (employer_id, candidate_profile_id) values ($1,$2)",
        [fx.emp2, fx.candidateA.profileId],
      ),
    );
  });
});

describe("Contact unlock flow (explicit candidate consent gate)", () => {
  test("employer get_unlocked_contact is DENIED before candidate approval", async () => {
    await actAs(client, fx.empAuth1);
    await expectRejected(
      () => client.query("select * from public.get_unlocked_contact($1)", [fx.candidateA.candId]),
      "contact_not_approved",
    );
  });

  test("end-to-end: request -> candidate approves -> employer can read contact", async () => {
    // 1. Subscribed employer raises a request.
    await actAs(client, fx.empAuth1);
    const reqId = (
      await client.query(
        "insert into public.contact_unlock_requests (employer_id, candidate_id, candidate_profile_id) values ($1,$2,$3) returning id",
        [fx.emp1, fx.candidateA.candId, fx.candidateA.profileId],
      )
    ).rows[0].id;

    // 2. Candidate approves via the privileged RPC.
    await actAs(client, fx.candAuthA);
    await client.query("select public.candidate_respond_to_unlock($1, true, $2, $3)", [
      reqId,
      "I consent to be contacted by BuildCo.",
      "v1",
    ]);

    // 3. Employer can now read the contact details — and ONLY for this candidate.
    await actAs(client, fx.empAuth1);
    const res = await client.query("select * from public.get_unlocked_contact($1)", [
      fx.candidateA.candId,
    ]);
    assert.equal(res.rowCount, 1);
    assert.equal(res.rows[0].last_name, "Smith");
    assert.equal(res.rows[0].phone, "+61400000000");

    // Still denied for a DIFFERENT candidate that never approved.
    await expectRejected(
      () => client.query("select * from public.get_unlocked_contact($1)", [fx.candidateB.candId]),
      "contact_not_approved",
    );

    // Direct table access remains impossible even after approval.
    const direct = await client.query(
      "select * from public.candidate_private_details where candidate_id = $1",
      [fx.candidateA.candId],
    );
    assert.equal(direct.rowCount, 0, "private table itself stays unreadable to employers");
  });

  test("candidate can REVOKE consent, re-locking contact access", async () => {
    await actAs(client, fx.candAuthA);
    await client.query("select public.candidate_revoke_contact($1)", [fx.emp1]);

    await actAs(client, fx.empAuth1);
    await expectRejected(
      () => client.query("select * from public.get_unlocked_contact($1)", [fx.candidateA.candId]),
      "contact_not_approved",
    );
  });
});

describe("Candidate self-service isolation", () => {
  test("candidate reads ONLY their own private details", async () => {
    await actAs(client, fx.candAuthA);
    const own = await client.query("select * from public.candidate_private_details");
    assert.equal(own.rowCount, 1);
    assert.equal(own.rows[0].candidate_id, fx.candidateA.candId);
  });

  test("candidate CANNOT read another candidate's documents", async () => {
    await actAs(client, fx.candAuthA);
    const res = await client.query(
      "select * from public.candidate_documents where candidate_id = $1",
      [fx.candidateB.candId],
    );
    assert.equal(res.rowCount, 0);
  });

  test("candidate CANNOT read raw AI extraction output", async () => {
    await actAs(client, fx.candAuthA);
    const res = await client.query("select * from public.ai_extraction_results");
    assert.equal(res.rowCount, 0);
  });
});

describe("Admin access + audit log confidentiality", () => {
  test("reviewer admin can read candidates, private details and AI results", async () => {
    await actAs(client, fx.adminAuthReviewer);
    assert.ok((await client.query("select * from public.candidates")).rowCount! >= 2);
    assert.ok((await client.query("select * from public.candidate_private_details")).rowCount! >= 2);
    assert.ok((await client.query("select * from public.ai_extraction_results")).rowCount! >= 1);
  });

  test("plain reviewer CANNOT read audit_logs (senior+ only)", async () => {
    await actAs(client, fx.adminAuthReviewer);
    const res = await client.query("select * from public.audit_logs");
    assert.equal(res.rowCount, 0);
  });

  test("super_admin CAN read audit_logs and sees recorded sensitive access", async () => {
    await actAs(client, fx.adminAuthSuper);
    const res = await client.query(
      "select action from public.audit_logs where action in ('contact_unlock_viewed','contact_request_approved','contact_approval_revoked')",
    );
    assert.ok(res.rowCount! >= 1, "sensitive access must be audit logged");
  });
});

describe("Anonymous + append-only guarantees", () => {
  test("anon cannot read any candidate data", async () => {
    await actAsAnon(client);
    await expectRejected(() => client.query("select * from public.candidate_private_details"));
  });

  test("nobody (not even admin) can UPDATE or DELETE audit_logs", async () => {
    await actAs(client, fx.adminAuthSuper);
    await expectRejected(() => client.query("update public.audit_logs set action = 'tamper'"));
    await expectRejected(() => client.query("delete from public.audit_logs"));
  });

  test("service_role bypasses RLS for trusted server operations", async () => {
    await actAsServiceRole(client);
    const res = await client.query("select * from public.candidate_private_details");
    assert.ok(res.rowCount! >= 2);
  });
});
