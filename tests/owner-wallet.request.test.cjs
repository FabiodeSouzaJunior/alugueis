const assert = require("node:assert/strict");

function runCase(name, fn) {
  fn();
  console.log(`ok - ${name}`);
}

(async () => {
  const requestUtils = await import("../server/modules/financial/owner-wallet.request.js");

  runCase("ignora owner_id, property_id e available_balance enviados pelo cliente", () => {
    const payload = requestUtils.normalizeOwnerWithdrawalPayload({
      payoutMethodId: "pm-1",
      amount: "1500,00",
      idempotencyKey: "idem-1",
      note: "saque abril",
      ownerId: "owner-malicioso",
      propertyId: "prop-malicioso",
      availableBalance: 999999,
    });

    assert.deepEqual(payload, {
      payoutMethodId: "pm-1",
      amount: "1500,00",
      idempotencyKey: "idem-1",
      note: "saque abril",
    });
  });

  runCase("limita paginacao de ledger e withdrawals no backend", () => {
    const request = {
      url: "https://app.local/api/owner/wallet/ledger?limit=500&offset=-20",
    };

    assert.deepEqual(requestUtils.readPaginationFromRequest(request), {
      limit: 100,
      offset: 0,
    });
  });

  runCase("normaliza resolucao administrativa de saque e saneia providerResponse", () => {
    const payload = requestUtils.normalizeOwnerWithdrawalResolutionPayload({
      resolution: " Succeeded ",
      failureReason: "  ",
      providerResponse: ["nao", "aceito"],
    });

    assert.deepEqual(payload, {
      resolution: "succeeded",
      failureReason: null,
      providerResponse: {},
    });
  });

  console.log("owner wallet request tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
