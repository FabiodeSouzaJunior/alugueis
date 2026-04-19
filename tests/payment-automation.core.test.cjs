const assert = require("node:assert/strict");

function runCase(name, fn) {
  fn();
  console.log(`ok - ${name}`);
}

(async () => {
  const automationCore = await import("../server/modules/financial/payment-automation.core.js");
  const paymentDates = await import("../lib/payment-dates.js");

  runCase("mantem horizonte no mes atual antes do vencimento", () => {
    const window = automationCore.resolveRecurringAutomationWindow({
      paymentDay: 20,
      referenceDate: new Date("2026-04-16T10:00:00-03:00"),
      timeZone: "America/Sao_Paulo",
    });

    assert.deepEqual(window.currentPeriod, { month: 4, year: 2026 });
    assert.deepEqual(window.targetPeriod, { month: 4, year: 2026 });
    assert.equal(window.shouldHaveNextMonth, false);
  });

  runCase("avanca o horizonte para o proximo mes no dia do vencimento", () => {
    const window = automationCore.resolveRecurringAutomationWindow({
      paymentDay: 16,
      referenceDate: new Date("2026-04-16T08:00:00-03:00"),
      timeZone: "America/Sao_Paulo",
    });

    assert.deepEqual(window.currentPeriod, { month: 4, year: 2026 });
    assert.deepEqual(window.targetPeriod, { month: 5, year: 2026 });
    assert.equal(window.shouldHaveNextMonth, true);
  });

  runCase("vira dezembro para janeiro corretamente", () => {
    const window = automationCore.resolveRecurringAutomationWindow({
      paymentDay: 31,
      referenceDate: new Date("2026-12-31T12:00:00-03:00"),
      timeZone: "America/Sao_Paulo",
    });

    assert.deepEqual(window.targetPeriod, { month: 1, year: 2027 });
  });

  runCase("recupera periodos em atraso ate ficar um mes a frente", () => {
    const result = automationCore.buildRecurringPeriodsToEnsure({
      startDate: "2026-01-01",
      paymentDay: 20,
      existingPeriods: [{ month: 4, year: 2026 }],
      referenceDate: new Date("2026-06-21T09:00:00-03:00"),
      timeZone: "America/Sao_Paulo",
    });

    assert.deepEqual(result.periods, [
      { month: 5, year: 2026 },
      { month: 6, year: 2026 },
      { month: 7, year: 2026 },
    ]);
  });

  runCase("nao duplica quando o periodo atual e o seguinte ja existem", () => {
    const result = automationCore.buildRecurringPeriodsToEnsure({
      startDate: "2026-01-01",
      paymentDay: 10,
      existingPeriods: [
        { month: 4, year: 2026 },
        { month: 5, year: 2026 },
      ],
      referenceDate: new Date("2026-04-16T09:00:00-03:00"),
      timeZone: "America/Sao_Paulo",
    });

    assert.deepEqual(result.periods, []);
  });

  runCase("status calculado respeita atraso com data local de negocio", () => {
    const status = automationCore.resolveCalculatedPaymentStatus({
      paymentDate: null,
      dueDate: "2026-04-10",
      amount: 0,
      expectedAmount: 1200,
      todayIsoDate: "2026-04-16",
    });

    assert.equal(status, "atrasado");
  });

  runCase("identifica corretamente a competencia atual", () => {
    const currentPeriodKey = automationCore.getCurrentPeriodKey({
      referenceDate: new Date("2026-04-17T10:00:00-03:00"),
      timeZone: "America/Sao_Paulo",
    });

    assert.equal(currentPeriodKey, automationCore.getPeriodKey(4, 2026));
  });

  runCase("classifica competencias em passado, atual e futuro", () => {
    const options = {
      referenceDate: new Date("2026-04-17T10:00:00-03:00"),
      timeZone: "America/Sao_Paulo",
    };

    assert.equal(
      automationCore.getPeriodRelationToCurrent({
        month: 3,
        year: 2026,
        ...options,
      }),
      "past"
    );
    assert.equal(
      automationCore.getPeriodRelationToCurrent({
        month: 4,
        year: 2026,
        ...options,
      }),
      "current"
    );
    assert.equal(
      automationCore.getPeriodRelationToCurrent({
        month: 5,
        year: 2026,
        ...options,
      }),
      "future"
    );
  });

  runCase("data persistida do pagamento replica o vencimento quando quitado", () => {
    assert.equal(
      automationCore.resolveStoredPaymentDate({
        status: "pago",
        dueDate: "2026-05-10",
      }),
      "2026-05-10"
    );

    assert.equal(
      automationCore.resolveStoredPaymentDate({
        status: "pendente",
        dueDate: "2026-05-10",
      }),
      null
    );
  });

  runCase("datas de vencimento respeitam meses curtos", () => {
    assert.equal(paymentDates.getDueDateForPeriod(2, 2025, 31), "2025-02-28");
    assert.equal(paymentDates.getDueDateForPeriod(2, 2024, 31), "2024-02-29");
  });

  console.log("payment automation tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
