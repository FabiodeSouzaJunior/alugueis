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

  await runCase("monta URL recomendada do webhook com query string da secret", () => {
    const config = service.getAbacatepayWebhookConfigStatus({
      origin: "https://alugueis-two.vercel.app/",
    });

    assert.equal(
      config.recommendedUrl,
      "https://alugueis-two.vercel.app/api/webhooks/abacatepay?webhookSecret=whsec_123"
    );
    assert.equal(config.signatureKeyConfigured, true);
    assert.equal(config.secretConfigured, true);
  });

  await runCase("envia PIX para terceiro pelo endpoint v2 de payouts", async () => {
    process.env.ABACATEPAY_API_KEY = "test-api-key";
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
      await service.sendPixTransfer({
        amount: 350,
        externalId: "wdr-123",
        method: "PIX",
        description: "Repasse SaaS",
        pix: {
          type: "CPF",
          key: "12345678901",
        },
      });
    } finally {
      global.fetch = originalFetch;
    }

    assert.equal(fetchInput.toString(), "https://api.abacatepay.com/v2/payouts/create");
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
    process.env.ABACATEPAY_API_KEY = "test-api-key";
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
      await service.getPixTransferByExternalId("wdr-123");
    } finally {
      global.fetch = originalFetch;
    }

    assert.equal(fetchInput.toString(), "https://api.abacatepay.com/v2/payouts/get?externalId=wdr-123");
    assert.equal(fetchInit.method, "GET");
  });

  await runCase("explica incompatibilidade de versao da chave no payout", async () => {
    process.env.ABACATEPAY_API_KEY = "test-api-key";
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
          }),
        /API v2/
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
