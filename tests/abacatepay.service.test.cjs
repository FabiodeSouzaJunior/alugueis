const assert = require("node:assert/strict");
const crypto = require("node:crypto");

async function runCase(name, fn) {
  await fn();
  console.log(`ok - ${name}`);
}

(async () => {
  process.env.ABACATEPAY_WEBHOOK_PUBLIC_KEY = "test-public-key";
  delete process.env.ABACATEPAY_WEBHOOK_SECRET;

  const service = await import("../server/modules/financial/abacatepay.service.js");
  const providerConfig = {
    id: "cfg-1",
    provider: "abacatepay",
    apiKey: "test-api-key",
    providerAccountId: "acct-1",
    environment: "test",
  };

  await runCase("aceita webhook apenas com assinatura quando secret nao esta configurada", () => {
    const rawBody = JSON.stringify({ event: "transfer.completed", id: "evt-1" });
    const signature = crypto
      .createHmac("sha256", process.env.ABACATEPAY_WEBHOOK_PUBLIC_KEY)
      .update(Buffer.from(rawBody, "utf8"))
      .digest("base64");

    const result = service.validateAbacatepayWebhookRequest({
      rawBody,
      signatureFromHeader: signature,
      providedSecret: "",
    });

    assert.equal(result.webhookSecretConfigured, false);
    assert.equal(result.webhookSecretSkipped, true);
    assert.equal(result.signatureValid, true);
    assert.equal(result.allowed, true);
  });

  await runCase("rejeita secret incorreta quando ela esta configurada", () => {
    process.env.ABACATEPAY_WEBHOOK_SECRET = "whsec_123";
    const rawBody = JSON.stringify({ event: "transfer.completed", id: "evt-2" });
    const signature = crypto
      .createHmac("sha256", process.env.ABACATEPAY_WEBHOOK_PUBLIC_KEY)
      .update(Buffer.from(rawBody, "utf8"))
      .digest("base64");

    const invalid = service.validateAbacatepayWebhookRequest({
      rawBody,
      signatureFromHeader: signature,
      providedSecret: "whsec_errada",
    });
    const valid = service.validateAbacatepayWebhookRequest({
      rawBody,
      signatureFromHeader: signature,
      providedSecret: "whsec_123",
    });

    assert.equal(invalid.webhookSecretConfigured, true);
    assert.equal(invalid.webhookSecretProvided, true);
    assert.equal(invalid.webhookSecretValid, false);
    assert.equal(invalid.allowed, false);
    assert.equal(valid.webhookSecretValid, true);
    assert.equal(valid.allowed, true);
  });

  await runCase("aceita webhook assinado sem query secret quando secret esta configurada", () => {
    process.env.ABACATEPAY_WEBHOOK_SECRET = "whsec_123";
    const rawBody = JSON.stringify({ event: "transfer.completed", id: "evt-3" });
    const signature = crypto
      .createHmac("sha256", process.env.ABACATEPAY_WEBHOOK_PUBLIC_KEY)
      .update(Buffer.from(rawBody, "utf8"))
      .digest("base64");

    const result = service.validateAbacatepayWebhookRequest({
      rawBody,
      signatureFromHeader: signature,
      providedSecret: "",
    });

    assert.equal(result.webhookSecretConfigured, true);
    assert.equal(result.webhookSecretProvided, false);
    assert.equal(result.webhookSecretValid, true);
    assert.equal(result.signatureValid, true);
    assert.equal(result.allowed, true);
  });

  await runCase("monta URL recomendada do webhook sem expor secrets", () => {
    const config = service.getAbacatepayWebhookConfigStatus({
      origin: "https://alugueis-two.vercel.app/",
    });

    assert.equal(
      config.recommendedUrl,
      "https://alugueis-two.vercel.app/api/webhooks/abacatepay?providerConfigId=<provider_config_id>"
    );
    assert.equal(config.signatureKeyConfigured, true);
    assert.equal(config.secretConfigured, true);
  });

  await runCase("envia PIX para terceiro pelo endpoint v2 de payouts", async () => {
    const originalFetch = global.fetch;
    let fetchInput = null;
    let fetchInit = null;

    global.fetch = async (input, init) => {
      fetchInput = input;
      fetchInit = init;
      return {
        ok: true,
        json: async () => ({
          data: {
            id: "tran_123",
            status: "PENDING",
            externalId: "wdr-123",
          },
          error: null,
          success: true,
        }),
      };
    };

    let result = null;
    try {
      result = await service.sendPixTransfer({
        amount: 350,
        externalId: "wdr-123",
        method: "PIX",
        description: "Repasse SaaS",
        pix: {
          type: "CPF",
          key: "12345678901",
        },
      }, {
        providerConfig,
      });
    } finally {
      global.fetch = originalFetch;
    }

    assert.equal(fetchInput.toString(), "https://api.abacatepay.com/v2/payouts/create");
    assert.equal(service.getAbacatepayResponseApiVersion(result), 2);
    assert.equal(fetchInit.method, "POST");
    assert.equal(fetchInit.headers.Authorization, "Bearer test-api-key");
    assert.deepEqual(JSON.parse(fetchInit.body), {
      amount: 350,
      externalId: "wdr-123",
      method: "PIX",
      description: "Repasse SaaS",
      pix: {
        type: "CPF",
        key: "12345678901",
      },
    });
  });

  await runCase("consulta PIX enviado pelo externalId no endpoint v2 de payouts", async () => {
    const originalFetch = global.fetch;
    let fetchInput = null;
    let fetchInit = null;

    global.fetch = async (input, init) => {
      fetchInput = input;
      fetchInit = init;
      return {
        ok: true,
        json: async () => ({
          data: {
            id: "tran_123",
            status: "PENDING",
            externalId: "wdr-123",
          },
          error: null,
          success: true,
        }),
      };
    };

    try {
      await service.getPixTransferByExternalId("wdr-123", { providerConfig });
    } finally {
      global.fetch = originalFetch;
    }

    assert.equal(fetchInput.toString(), "https://api.abacatepay.com/v2/payouts/get?externalId=wdr-123");
    assert.equal(fetchInit.method, "GET");
  });

  await runCase("cai para endpoint v1 quando a chave nao aceita payout v2", async () => {
    const originalFetch = global.fetch;
    const urls = [];

    global.fetch = async (input) => {
      urls.push(input.toString());
      if (input.toString().includes("/v2/")) {
        return {
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          json: async () => ({
            data: null,
            error: "API key version mismatch",
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          data: {
            id: "tran_v1",
            status: "PENDING",
            externalId: "wdr-123",
          },
          error: null,
        }),
      };
    };

    try {
      const result = await service.sendPixTransfer({
        amount: 350,
        externalId: "wdr-123",
        method: "PIX",
        pix: {
          type: "CPF",
          key: "12345678901",
        },
      }, {
        providerConfig,
      });

      assert.equal(result.data.id, "tran_v1");
      assert.deepEqual(urls, [
        "https://api.abacatepay.com/v2/payouts/create",
        "https://api.abacatepay.com/v1/withdraw/create",
      ]);
      assert.equal(service.getAbacatepayResponseApiVersion(result), 1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  await runCase("cai para endpoint v1 quando a chave nao aceita pix qrcode v2", async () => {
    const originalFetch = global.fetch;
    const calls = [];

    global.fetch = async (input, init) => {
      calls.push({ url: input.toString(), body: JSON.parse(init.body) });
      if (input.toString().includes("/v2/")) {
        return {
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          json: async () => ({
            data: null,
            error: "API key version mismatch",
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          data: {
            id: "pix_v1",
            status: "PENDING",
            amount: 1000,
            brCode: "000201",
            brCodeBase64: "data:image/png;base64,abc",
          },
          error: null,
        }),
      };
    };

    try {
      const result = await service.createTransparentPixCharge({
        amountCents: 1000,
        description: "Aluguel 01/2026 - Fulano de Tal",
        expiresInSeconds: 1800,
        customer: { email: "fulano@example.com" },
        metadata: { paymentId: "pay-1" },
        providerConfig,
      });

      assert.equal(result.data.id, "pix_v1");
      assert.equal(calls[0].url, "https://api.abacatepay.com/v2/transparents/create");
      assert.equal(calls[1].url, "https://api.abacatepay.com/v1/pixQrCode/create");
      assert.deepEqual(calls[1].body, {
        amount: 1000,
        expiresIn: 1800,
        description: "Aluguel 01/2026 - Fulano de Tal".slice(0, 37),
        metadata: { paymentId: "pay-1" },
      });
      assert.equal(service.getAbacatepayResponseApiVersion(result), 1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  await runCase("explica quando a chave nao aceita nem v2 nem v1", async () => {
    const originalFetch = global.fetch;

    global.fetch = async () => ({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({
        data: null,
        error: "API key version mismatch",
      }),
    });

    try {
      await assert.rejects(
        () =>
          service.sendPixTransfer({
            amount: 350,
            externalId: "wdr-123",
            method: "PIX",
            pix: {
              type: "CPF",
              key: "12345678901",
            },
          }, {
            providerConfig,
          }),
        /v1 e v2/
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  console.log("abacatepay service tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
