const assert = require("node:assert/strict");

async function runCase(name, fn) {
  await fn();
  console.log(`ok - ${name}`);
}

(async () => {
  const service = await import("../server/modules/financial/asaas.service.js");
  const providerConfig = {
    id: "cfg-asaas-1",
    provider: "asaas",
    apiKey: "$aact_test",
    providerAccountId: "asaas-account-1",
    environment: "sandbox",
    webhookSecret: "asaas-webhook-token",
  };

  await runCase("cria cobranca PIX ASAAS com cliente, payment e QR Code", async () => {
    const originalFetch = global.fetch;
    const calls = [];

    global.fetch = async (input, init = {}) => {
      calls.push({
        url: input.toString(),
        method: init.method,
        headers: init.headers,
        body: init.body ? JSON.parse(init.body) : null,
      });

      if (input.toString().endsWith("/v3/customers")) {
        return {
          ok: true,
          json: async () => ({
            id: "cus_123",
            name: "Fulano",
          }),
        };
      }

      if (input.toString().endsWith("/v3/payments")) {
        return {
          ok: true,
          json: async () => ({
            id: "pay_123",
            status: "PENDING",
            value: 10,
            netValue: 9.5,
            invoiceUrl: "https://sandbox.asaas.com/i/pay_123",
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          encodedImage: "abc123",
          payload: "000201",
          expirationDate: "2026-04-23",
        }),
      };
    };

    let result = null;
    try {
      result = await service.createAsaasPixCharge({
        amountCents: 1000,
        description: "Aluguel 04/2026 - Fulano",
        dueDate: "2026-04-30",
        customer: {
          name: "Fulano",
          taxId: "123.456.789-01",
          email: "fulano@example.com",
        },
        metadata: {
          paymentId: "pay-local-1",
          tenantId: "tenant-1",
        },
        providerConfig,
      });
    } finally {
      global.fetch = originalFetch;
    }

    assert.equal(calls.length, 3);
    assert.equal(calls[0].url, "https://api-sandbox.asaas.com/v3/customers");
    assert.equal(calls[0].headers.access_token, "$aact_test");
    assert.deepEqual(calls[0].body, {
      name: "Fulano",
      cpfCnpj: "12345678901",
      notificationDisabled: true,
      email: "fulano@example.com",
      externalReference: "tenant-1",
    });
    assert.equal(calls[1].url, "https://api-sandbox.asaas.com/v3/payments");
    assert.equal(calls[1].body.customer, "cus_123");
    assert.equal(calls[1].body.billingType, "PIX");
    assert.equal(calls[1].body.value, 10);
    assert.equal(calls[1].body.externalReference, "pay-local-1");
    assert.equal(calls[2].url, "https://api-sandbox.asaas.com/v3/payments/pay_123/pixQrCode");

    const sanitized = service.sanitizeAsaasCheckoutPayload(result);
    assert.equal(sanitized.id, "pay_123");
    assert.equal(sanitized.amount, 1000);
    assert.equal(sanitized.platformFee, 50);
    assert.equal(sanitized.brCode, "000201");
    assert.equal(sanitized.brCodeBase64, "data:image/png;base64,abc123");
    assert.equal(service.getAsaasResponseApiVersion(result), 3);
  });

  await runCase("monta e envia transferencia PIX ASAAS", async () => {
    const originalFetch = global.fetch;
    let fetchInput = null;
    let fetchInit = null;

    global.fetch = async (input, init = {}) => {
      fetchInput = input;
      fetchInit = init;
      return {
        ok: true,
        json: async () => ({
          id: "trf_123",
          status: "PENDING",
          value: 3.5,
          externalReference: "wdr-123",
        }),
      };
    };

    try {
      const payload = service.buildAsaasPixTransferPayload({
        amountCents: 350,
        externalId: "wdr-123",
        description: "Repasse SaaS",
        pixKeyType: "RANDOM",
        pixKey: "89bd5e4e-2393-4bd1-b973-2010c3169ea",
      });

      await service.sendAsaasPixTransfer(payload, { providerConfig });

      assert.deepEqual(payload, {
        value: 3.5,
        operationType: "PIX",
        pixAddressKey: "89bd5e4e-2393-4bd1-b973-2010c3169ea",
        pixAddressKeyType: "EVP",
        scheduleDate: null,
        description: "Repasse SaaS",
        externalReference: "wdr-123",
      });
    } finally {
      global.fetch = originalFetch;
    }

    assert.equal(fetchInput.toString(), "https://api-sandbox.asaas.com/v3/transfers");
    assert.equal(fetchInit.method, "POST");
    assert.equal(fetchInit.headers.access_token, "$aact_test");
  });

  await runCase("consulta transferencia ASAAS pelo providerReferenceId", async () => {
    const originalFetch = global.fetch;
    let fetchInput = null;

    global.fetch = async (input) => {
      fetchInput = input;
      return {
        ok: true,
        json: async () => ({
          id: "trf_123",
          status: "DONE",
          value: 3.5,
          externalReference: "wdr-123",
        }),
      };
    };

    try {
      const result = await service.getAsaasPixTransferByExternalId("wdr-123", {
        providerConfig,
        providerReferenceId: "trf_123",
      });
      assert.equal(result.id, "trf_123");
    } finally {
      global.fetch = originalFetch;
    }

    assert.equal(fetchInput.toString(), "https://api-sandbox.asaas.com/v3/transfers/trf_123");
  });

  await runCase("valida token de webhook ASAAS por header", () => {
    const valid = service.validateAsaasWebhookRequest({
      headers: {
        "asaas-access-token": "asaas-webhook-token",
      },
      expectedToken: "asaas-webhook-token",
    });
    const invalid = service.validateAsaasWebhookRequest({
      headers: {
        "asaas-access-token": "wrong",
      },
      expectedToken: "asaas-webhook-token",
    });

    assert.equal(valid.allowed, true);
    assert.equal(valid.tokenValid, true);
    assert.equal(invalid.allowed, false);
    assert.equal(invalid.tokenValid, false);
  });

  await runCase("mapeia status de transferencia ASAAS", () => {
    assert.equal(service.mapAsaasTransferStatusToWithdrawalResolution("PENDING"), null);
    assert.equal(service.mapAsaasTransferStatusToWithdrawalResolution("DONE"), "succeeded");
    assert.equal(service.mapAsaasTransferStatusToWithdrawalResolution("FAILED"), "failed");
    assert.equal(service.mapAsaasTransferStatusToWithdrawalResolution("CANCELLED"), "cancelled");
  });

  console.log("asaas service tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
