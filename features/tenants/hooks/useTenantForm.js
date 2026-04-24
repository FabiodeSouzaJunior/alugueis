"use client";

import { useEffect, useMemo, useState } from "react";

import {
  buildTenantPayload,
  computeIptuMonthlyValue,
  createTenantFormValues,
  defaultTenantFormValues,
  isValidTenantEmail,
  normalizeTenantEmail,
  validateTenantForm,
} from "../utils/tenant-form.utils";
import {
  fetchTenantPropertyUnits,
  fetchTenantRegistrationRequirements,
} from "../services/tenants.service";

export function useTenantForm({ tenant, initialValues = {} }) {
  const initialValuesKey = JSON.stringify(initialValues || {});
  const stableInitialValues = useMemo(() => initialValues || {}, [initialValuesKey]);
  const [form, setForm] = useState(() => createTenantFormValues(tenant, stableInitialValues));
  const [errors, setErrors] = useState({});
  const [units, setUnits] = useState([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [registrationRequirements, setRegistrationRequirements] = useState({
    loading: true,
    activePaymentProvider: null,
    activePaymentProviderLabel: null,
    requiresAsaasTenantFields: false,
  });
  const [initialPropertyId, setInitialPropertyId] = useState(
    () => createTenantFormValues(tenant, stableInitialValues).propertyId || null
  );

  useEffect(() => {
    const nextValues = createTenantFormValues(tenant, stableInitialValues);
    setForm(nextValues);
    setErrors({});
    setInitialPropertyId(nextValues.propertyId || null);
  }, [stableInitialValues, tenant]);

  useEffect(() => {
    let cancelled = false;

    fetchTenantRegistrationRequirements()
      .then((data) => {
        if (cancelled) return;
        setRegistrationRequirements({
          loading: false,
          activePaymentProvider: data?.activePaymentProvider || null,
          activePaymentProviderLabel: data?.activePaymentProviderLabel || null,
          requiresAsaasTenantFields: data?.requiresAsaasTenantFields === true,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setRegistrationRequirements({
          loading: false,
          activePaymentProvider: null,
          activePaymentProviderLabel: null,
          requiresAsaasTenantFields: false,
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!form.propertyId) {
      setUnits([]);
      return;
    }

    let cancelled = false;
    setLoadingUnits(true);

    fetchTenantPropertyUnits(form.propertyId)
      .then((data) => {
        if (cancelled) return;

        const unitList = Array.isArray(data) ? data : [];
        setUnits(unitList);

        if (tenant && form.propertyId === initialPropertyId) {
          const matchByTenant = unitList.find(
            (unit) =>
              unit.residentTenantId === tenant.id ||
              unit.tenantId === tenant.id ||
              (Array.isArray(unit.residentTenantIds) && unit.residentTenantIds.includes(tenant.id))
          );
          const matchByLabel =
            !matchByTenant && tenant.kitnetNumber
              ? unitList.find((unit) => unit.unitLabel === String(tenant.kitnetNumber))
              : null;
          const match = matchByTenant || matchByLabel;
          if (match) {
            setForm((currentForm) => ({ ...currentForm, unitId: match.id }));
          }
        }
      })
      .catch(() => {
        if (!cancelled) setUnits([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingUnits(false);
      });

    return () => {
      cancelled = true;
    };
  }, [form.propertyId, initialPropertyId, tenant]);

  function setFieldValue(field, value) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
    setErrors((currentErrors) => {
      if (!currentErrors[field]) return currentErrors;
      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  }

  function handleRentChange(value) {
    let nextValue = String(value || "").replace(/\D/g, "");
    if (nextValue) nextValue = (Number(nextValue) / 100).toFixed(2).replace(".", ",");
    setFieldValue("rentValue", nextValue);
  }

  function handlePropertyChange(value) {
    const propertyId = value === "none" ? "" : value;
    setForm((currentForm) => ({
      ...currentForm,
      propertyId,
      unitId: "",
      kitnetNumber: "",
    }));
    setErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      delete nextErrors.propertyId;
      delete nextErrors.unitId;
      return nextErrors;
    });
  }

  function handleUnitChange(value) {
    if (value === "none") {
      setForm((currentForm) => ({ ...currentForm, unitId: "", kitnetNumber: "" }));
      return;
    }

    const selectedUnit = units.find((unit) => unit.id === value);
    setForm((currentForm) => ({
      ...currentForm,
      unitId: value,
      kitnetNumber: selectedUnit?.unitLabel || currentForm.kitnetNumber,
    }));
  }

  function handlePaymentResponsibleChange(checked) {
    if (checked) {
      const normalizedEmail = normalizeTenantEmail(form.email);
      if (!normalizedEmail) {
        setErrors((currentErrors) => ({
          ...currentErrors,
          email: "Preencha o email antes de marcar como responsavel pelo pagamento.",
        }));
        return;
      }
      if (!isValidTenantEmail(normalizedEmail)) {
        setErrors((currentErrors) => ({
          ...currentErrors,
          email: "Informe um email valido antes de marcar como responsavel pelo pagamento.",
        }));
        return;
      }
    }

    setFieldValue("isPaymentResponsible", !!checked);
    if (!checked) {
      setForm((currentForm) => ({
        ...currentForm,
        rentValue: "",
        iptuValue: "",
        iptuAddToRent: false,
        iptuInstallments: "12",
      }));
      setErrors((currentErrors) => {
        if (!currentErrors.email && !currentErrors.propertyId) return currentErrors;
        const nextErrors = { ...currentErrors };
        delete nextErrors.email;
        delete nextErrors.propertyId;
        return nextErrors;
      });
    }
  }

  function handleIptuChange(value) {
    let nextValue = String(value || "").replace(/\D/g, "");
    if (nextValue) nextValue = (Number(nextValue) / 100).toFixed(2).replace(".", ",");
    setFieldValue("iptuValue", nextValue);
  }

  function handleZipCodeChange(value) {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
    if (!digits) {
      setFieldValue("addressZipCode", "");
      return;
    }
    const formatted = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
    setFieldValue("addressZipCode", formatted);
  }

  const iptuMonthlyValue = computeIptuMonthlyValue(form);
  const computedRentWithIptu = (() => {
    const rawRent = String(form.rentValue || "").replace(/\D/g, "");
    const baseRent = rawRent ? Number(rawRent) / 100 : 0;
    return baseRent + iptuMonthlyValue;
  })();

  function submit(event, onSave) {
    event?.preventDefault?.();
    const nextErrors = validateTenantForm(form, registrationRequirements);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSave(buildTenantPayload(form));
  }

  return {
    form,
    errors,
    units,
    loadingUnits,
    setFieldValue,
    handleRentChange,
    handlePropertyChange,
    handleUnitChange,
    handlePaymentResponsibleChange,
    handleIptuChange,
    handleZipCodeChange,
    iptuMonthlyValue,
    computedRentWithIptu,
    registrationRequirements,
    submit,
  };
}
