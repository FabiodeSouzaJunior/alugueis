const assert = require("node:assert/strict");
const crypto = require("node:crypto");

function runCase(name, fn) {
  fn();
  console.log(`ok - ${name}`);
}

(async () => {
  process.env.ABACATEPAY_WEBHOOK_PUBLIC_KEY = "test-public-hmac-key";

  const walletUtils = await import("../server/modules/financial/owner-wallet.utils.js");

  runCase("libera credito 20 segundos apos o pagamento confirmado", () => {
    assert.equal(
      walletUtils.computeFundsAvailableAt("2026-04-18T12:00:00.000Z"),
      "2026-04-18T12:00:20.000Z"
    );
  });

  runCase("recalcula creditos antigos com trava maior para a janela efetiva de 20 segundos", () => {
    assert.equal(
      walletUtils.resolveEffectiveAvailableAt({
        entryType: "payment_credit",
        paidAt: "2026-04-18T12:00:00.000Z",
        availableAt: "2026-04-21T12:00:00.000Z",
        createdAt: "2026-04-18T12:00:00.000Z",
      }),
      "2026-04-18T12:00:20.000Z"
    );
  });

  runCase("deduplica webhook por tipo mais event id quando ele existe", () => {
    const key = walletUtils.buildNormalizedWebhookEventKey({
      event: "checkout.completed",
      id: "evt-123",
      data: {
        checkout: {
          id: "chk-123",
          metadata: { paymentId: "pay-1" },
        },
      },
    });

    assert.equal(key, "checkout.completed:evt-123");
  });

  runCase("deduplica webhook por tipo, recurso e external id quando provider_event_id nao existe", () => {
    const key = walletUtils.buildNormalizedWebhookEventKey({
      event: "transparent.completed",
      data: {
        transparent: {
          id: "trn-99",
          externalId: "pay-99",
        },
      },
    });

    assert.equal(key, "transparent.completed:trn-99:pay-99");
  });

  runCase("interpreta reconciliation.paid no formato real do webhook", () => {
    const payload = {
      event: "reconciliation.paid",
      data: {
        id: "pix_char_123",
        amount: 110,
        status: "PAID",
        updatedAt: "2026-04-18T06:13:33.102Z",
        platformFee: 80,
        metadata: {
          paymentId: "pay-123",
          externalId: "portal_checkout_abc",
        },
      },
    };

    assert.equal(walletUtils.extractAbacatepayResourceId(payload), "pix_char_123");
    assert.equal(walletUtils.extractAbacatepayPaymentId(payload), "pay-123");
    assert.equal(walletUtils.extractPaidAmountCents(payload), 110);
    assert.equal(walletUtils.extractPlatformFeeCents(payload), 80);
    assert.equal(
      walletUtils.buildNormalizedWebhookEventKey(payload),
      "reconciliation.paid:pix_char_123:portal_checkout_abc"
    );
  });

  runCase("interpreta payload de reparo manual sem objeto data aninhado", () => {
    const payload = {
      event: "reconciliation.paid",
      amount: 120,
      paymentId: "pay-manual",
      paymentDate: "2026-04-17",
      checkoutId: "chk-manual",
    };

    assert.equal(walletUtils.extractAbacatepayPaymentId(payload), "pay-manual");
    assert.equal(walletUtils.extractPaidAmountCents(payload), 120);
    assert.equal(walletUtils.extractResourceUpdatedAt(payload), "2026-04-17");
  });

  runCase("aceita assinatura documentada nos dois headers conhecidos", () => {
    const signature = "sig-value";
    assert.equal(
      walletUtils.extractWebhookSignatureFromHeaders({
        "x-webhook-signature": signature,
      }),
      signature
    );
    assert.equal(
      walletUtils.extractWebhookSignatureFromHeaders({
        "x-abacate-signature": signature,
      }),
      signature
    );
  });

  runCase("valida assinatura HMAC usando a chave publica configurada no backend", () => {
    const rawBody = JSON.stringify({ event: "checkout.completed", id: "evt-1" });
    const signature = crypto
      .createHmac("sha256", process.env.ABACATEPAY_WEBHOOK_PUBLIC_KEY)
      .update(Buffer.from(rawBody, "utf8"))
      .digest("base64");

    assert.equal(walletUtils.verifyAbacatepaySignature(rawBody, signature), true);
    assert.equal(walletUtils.verifyAbacatepaySignature(rawBody, `${signature}x`), false);
  });

  runCase("mascara chaves PIX sem expor o valor completo", () => {
    assert.equal(walletUtils.maskPixKey("fulano@example.com", "email"), "fu***o@example.com");
    assert.equal(walletUtils.maskPixKey("12345678901", "cpf"), "123***01");
  });

  runCase("valida e normaliza chaves PIX antes de persistir ou enviar", () => {
    const validCpf = walletUtils.validatePixKeyValue("123.456.789-01", "cpf");
    const invalidCpf = walletUtils.validatePixKeyValue("123", "cpf");

    assert.equal(validCpf.valid, true);
    assert.equal(validCpf.normalizedValue, "12345678901");
    assert.equal(invalidCpf.valid, false);
    assert.equal(invalidCpf.reason, "pix_key_invalid_cpf");
  });

  runCase("monta payload do saque com o contrato documentado pela AbacatePay", () => {
    const payload = walletUtils.buildAbacatePixTransferPayload({
      amountCents: 1550,
      externalId: "wdr-123",
      description: "Repasse SaaS",
      pixKey: "contato@fornecedor.com",
      pixKeyType: "email",
    });

    assert.deepEqual(payload, {
      amount: 1550,
      externalId: "wdr-123",
      method: "PIX",
      description: "Repasse SaaS",
      pix: {
        key: "contato@fornecedor.com",
        type: "EMAIL",
      },
    });
  });

  runCase("mapeia status da AbacatePay para resolucao de saque", () => {
    assert.equal(walletUtils.mapAbacatepixTransferStatusToWithdrawalResolution("PENDING"), null);
    assert.equal(
      walletUtils.mapAbacatepixTransferStatusToWithdrawalResolution("COMPLETE"),
      "succeeded"
    );
    assert.equal(
      walletUtils.mapAbacatepixTransferStatusToWithdrawalResolution("FAILED"),
      "failed"
    );
    assert.equal(
      walletUtils.mapAbacatepixTransferStatusToWithdrawalResolution("CANCELLED"),
      "cancelled"
    );
    assert.equal(
      walletUtils.mapAbacatepixTransferStatusToWithdrawalResolution("COMPLETED"),
      "succeeded"
    );
  });

  runCase("recupera externalId de webhook v2 de payout", () => {
    const payload = {
      event: "payout.done",
      data: {
        payout: {
          id: "tran_123",
          status: "COMPLETE",
          externalId: "wdr_789",
        },
      },
    };

    assert.equal(walletUtils.extractAbacatepayExternalId(payload), "wdr_789");
  });

  console.log("owner wallet utils tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
