const assert = require("node:assert/strict");

function runCase(name, fn) {
  fn();
  console.log(`ok - ${name}`);
}

(async () => {
  const rules = await import("../server/modules/financial/owner-wallet.rules.js");
  const now = new Date("2026-04-19T12:00:00.000Z");

  runCase("cenario 1: pagamento feito no portal entra no saldo sacavel", () => {
    const snapshot = rules.buildWithdrawableBalanceSnapshot(
      [
        {
          entry_type: "payment_credit",
          direction: "credit",
          amount_cents: 15000,
          source: "tenant_portal",
          available_at: "2026-04-19T11:59:00.000Z",
          metadata: { paymentOrigin: "tenant_portal" },
        },
      ],
      now
    );

    assert.equal(snapshot.availableCents, 15000);
  });

  runCase("backfill confirmado do gateway tambem conta como pagamento do portal", () => {
    const snapshot = rules.buildWithdrawableBalanceSnapshot(
      [
        {
          entry_type: "payment_credit",
          direction: "credit",
          amount_cents: 350,
          source: "abacatepay_backfill",
          available_at: "2026-04-19T11:59:00.000Z",
          metadata: { eventType: "reconciliation.paid" },
        },
      ],
      now
    );

    assert.equal(snapshot.availableCents, 350);
  });

  runCase("cenario 2: pagamento lançado manualmente no admin nao entra no saldo sacavel", () => {
    const snapshot = rules.buildWithdrawableBalanceSnapshot(
      [
        {
          entry_type: "payment_credit",
          direction: "credit",
          amount_cents: 20000,
          source: "manual_payment_sync",
          available_at: "2026-04-19T11:59:00.000Z",
          metadata: { paymentOrigin: "admin_manual" },
        },
      ],
      now
    );

    assert.equal(snapshot.availableCents, 0);
  });

  runCase("cenario 3: pagamento marcado manualmente como pago no admin nao entra no saldo sacavel", () => {
    const snapshot = rules.buildWithdrawableBalanceSnapshot(
      [
        {
          entry_type: "payment_credit",
          direction: "credit",
          amount_cents: 18000,
          source: "admin_manual",
          available_at: "2026-04-19T11:59:00.000Z",
          metadata: { origin: "admin_manual" },
        },
      ],
      now
    );

    assert.equal(snapshot.availableCents, 0);
  });

  runCase("cenario 4: mistura portal + admin manual considera apenas o portal", () => {
    const snapshot = rules.buildWithdrawableBalanceSnapshot(
      [
        {
          entry_type: "payment_credit",
          direction: "credit",
          amount_cents: 10000,
          source: "tenant_portal",
          available_at: "2026-04-19T11:59:00.000Z",
          metadata: { paymentOrigin: "tenant_portal" },
        },
        {
          entry_type: "payment_credit",
          direction: "credit",
          amount_cents: 9000,
          source: "manual_payment_sync",
          available_at: "2026-04-19T11:59:00.000Z",
          metadata: { paymentOrigin: "admin_manual" },
        },
      ],
      now
    );

    assert.equal(snapshot.availableCents, 10000);
  });

  runCase("multiplos checkouts pagos do portal na mesma cobranca entram como transacoes independentes", () => {
    const snapshot = rules.buildWithdrawableBalanceSnapshot(
      [
        {
          entry_type: "payment_credit",
          direction: "credit",
          amount_cents: 680,
          source: "tenant_portal",
          available_at: "2026-04-19T11:59:00.000Z",
          metadata: { paymentId: "pay-1", providerCheckoutId: "pix-1", paymentOrigin: "tenant_portal" },
        },
        {
          entry_type: "payment_credit",
          direction: "credit",
          amount_cents: 680,
          source: "tenant_portal",
          available_at: "2026-04-19T11:59:00.000Z",
          metadata: { paymentId: "pay-1", providerCheckoutId: "pix-2", paymentOrigin: "tenant_portal" },
        },
        {
          entry_type: "gateway_fee_debit",
          direction: "debit",
          amount_cents: 80,
          source: "tenant_portal",
          metadata: { paymentOrigin: "tenant_portal" },
        },
        {
          entry_type: "gateway_fee_debit",
          direction: "debit",
          amount_cents: 80,
          source: "tenant_portal",
          metadata: { paymentOrigin: "tenant_portal" },
        },
      ],
      now
    );

    assert.equal(snapshot.availableCents, 1200);
  });

  runCase("taxa administrativa sem origem do portal nao reduz saldo sacavel", () => {
    const snapshot = rules.buildWithdrawableBalanceSnapshot(
      [
        {
          entry_type: "payment_credit",
          direction: "credit",
          amount_cents: 680,
          source: "tenant_portal",
          available_at: "2026-04-19T11:59:00.000Z",
          metadata: { paymentOrigin: "tenant_portal" },
        },
        {
          entry_type: "gateway_fee_debit",
          direction: "debit",
          amount_cents: 80,
          source: "manual_repair",
          metadata: {},
        },
      ],
      now
    );

    assert.equal(snapshot.availableCents, 680);
  });

  runCase("taxa do gateway so reduz saldo quando bate com o checkout do portal", () => {
    const snapshot = rules.buildWithdrawableBalanceSnapshot(
      [
        {
          entry_type: "payment_credit",
          direction: "credit",
          amount_cents: 120,
          source: "tenant_portal",
          available_at: "2026-04-19T11:59:00.000Z",
          metadata: { paymentOrigin: "tenant_portal" },
        },
        {
          entry_type: "gateway_fee_debit",
          direction: "debit",
          amount_cents: 80,
          source: "tenant_portal",
          checkout_fee_cents: 0,
          metadata: { paymentOrigin: "tenant_portal" },
        },
      ],
      now
    );

    assert.equal(snapshot.availableCents, 120);
  });

  runCase("cenario 5: tentativa de saque com saldo inflado por admin e bloqueada pelo saldo valido", () => {
    const snapshot = rules.buildWithdrawableBalanceSnapshot(
      [
        {
          entry_type: "payment_credit",
          direction: "credit",
          amount_cents: 12000,
          source: "tenant_portal",
          available_at: "2026-04-19T11:59:00.000Z",
          metadata: { paymentOrigin: "tenant_portal" },
        },
        {
          entry_type: "payment_credit",
          direction: "credit",
          amount_cents: 8000,
          source: "manual_payment_sync",
          available_at: "2026-04-19T11:59:00.000Z",
          metadata: { paymentOrigin: "admin_manual" },
        },
      ],
      now
    );

    assert.equal(snapshot.availableCents, 12000);
    assert.equal(15000 <= snapshot.availableCents, false);
    assert.equal(12000 <= snapshot.availableCents, true);
  });

  console.log("owner wallet rules tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
