"use client";

import { useState } from "react";
import {
  ELIGIBLE_STREET,
  HOUSE_NUMBER_MIN,
  HOUSE_NUMBER_MAX,
  EVENT_CONTACT,
  getTableById,
  isFloorDoorRequired,
  STANDARD_TABLE_SIZE_LABEL,
  tableHasClothingRack,
  validateRegistrationInput,
  type Language,
} from "@loppemarked/shared";
import { useLanguage } from "@/i18n/LanguageProvider";
import { renderWithContact } from "@/i18n/contactLink";
import { colors, alertError } from "@/styles/theme";
import { emitBookingSuccess } from "@/utils/brandEvents";
import { SwitchConfirmationDialog, type SwitchDetails } from "./SwitchConfirmationDialog";
import "@/styles/table-map.css";

interface RegistrationFormProps {
  boxId: number;
  onCancel: () => void;
  onBoxUnavailable?: () => void;
  onSuccess?: () => void;
  /** When true, renders without the back button (e.g. inside a detail panel). */
  embedded?: boolean;
}

export function RegistrationForm({ boxId, onCancel, onBoxUnavailable, onSuccess, embedded }: RegistrationFormProps) {
  const { language, t } = useLanguage();
  const table = getTableById(boxId);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [floor, setFloor] = useState("");
  const [door, setDoor] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [switchDetails, setSwitchDetails] = useState<SwitchDetails | null>(null);
  const [confirmingSwitch, setConfirmingSwitch] = useState(false);

  const parsedHouseNumber = parseInt(houseNumber, 10);
  const needsUnitFields = !isNaN(parsedHouseNumber) && isFloorDoorRequired(parsedHouseNumber);

  function buildPayload(opts?: { confirmSwitch?: boolean }) {
    // Drop floor/door from the payload when the house number doesn't require
    // them. Otherwise stale values (typed for a previous house number) would
    // leak through and corrupt the apartment dedupe key.
    return {
      name: name.trim(),
      email: email.trim(),
      street: ELIGIBLE_STREET,
      houseNumber: parsedHouseNumber,
      floor: needsUnitFields ? floor.trim() || null : null,
      door: needsUnitFields ? door.trim() || null : null,
      language: language as Language,
      boxId,
      ...opts,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);

    if (!consentChecked) {
      setErrors([t("consent.required")]);
      return;
    }

    const input = buildPayload();

    const validation = validateRegistrationInput(input);
    if (!validation.valid) {
      const fieldErrors: string[] = [];
      if (validation.errors["name"]) fieldErrors.push(t("validation.nameRequired"));
      if (validation.errors["email"]) {
        const isRequired = validation.errors["email"].toLowerCase().includes("required");
        fieldErrors.push(t(isRequired ? "validation.emailRequired" : "validation.emailInvalid"));
      }
      if (validation.errors["houseNumber"]) fieldErrors.push(t("validation.houseNumberInvalid"));
      if (validation.errors["floorDoor"]) fieldErrors.push(t("validation.floorDoorRequired"));
      if (validation.errors["boxId"]) fieldErrors.push(t("validation.boxIdInvalid"));
      setErrors(fieldErrors.length > 0 ? fieldErrors : [t("common.error")]);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/public/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        if (res.status === 409 && body?.code === "SWITCH_REQUIRED") {
          setSwitchDetails({
            existingBoxId: body.existingBoxId,
            existingBoxName: body.existingBoxName,
            existingGreenhouse: body.existingGreenhouse,
            newBoxId: body.newBoxId,
            newBoxName: body.newBoxName,
            newGreenhouse: body.newGreenhouse,
          });
          return;
        }
        if (body?.code === "BOX_UNAVAILABLE" && onBoxUnavailable) {
          onBoxUnavailable();
          return;
        }
        setErrors([body?.error ?? t("common.error")]);
        return;
      }

      setSuccess(true);
      emitBookingSuccess();
    } catch {
      setErrors([t("common.error")]);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmSwitch() {
    const input = buildPayload({ confirmSwitch: true });
    setConfirmingSwitch(true);
    setErrors([]);
    try {
      const res = await fetch("/public/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setSwitchDetails(null);
        setErrors([body?.error ?? t("common.error")]);
        return;
      }

      setSuccess(true);
      emitBookingSuccess();
      setSwitchDetails(null);
    } catch {
      setSwitchDetails(null);
      setErrors([t("common.error")]);
    } finally {
      setConfirmingSwitch(false);
    }
  }

  function handleCancelSwitch() {
    setSwitchDetails(null);
  }

  const sectionClass = `flea-scene-form${embedded ? " flea-scene-form--embedded" : ""}`;

  if (switchDetails) {
    return (
      <section className={sectionClass}>
        <SwitchConfirmationDialog
          switchDetails={switchDetails}
          onConfirm={handleConfirmSwitch}
          onCancel={handleCancelSwitch}
          confirming={confirmingSwitch}
        />
      </section>
    );
  }

  if (success) {
    return (
      <section className={sectionClass}>
        <h2 className="flea-scene-form__success-title">{t("registration.success")}</h2>
        <p className="flea-scene-form__success-body">
          {renderWithContact(t("registration.unregisterInfo"), { color: colors.fleaTerracottaDark, fontWeight: 600 })}
        </p>
        <button
          type="button"
          onClick={onSuccess ?? onCancel}
          className="flea-scene-cta flea-scene-cta--mt-lg"
        >
          {t("common.close")}
        </button>
      </section>
    );
  }

  return (
    <section className={sectionClass}>
      {!embedded && (
        <button type="button" onClick={onCancel} className="flea-scene-form__back">
          &larr; {t("common.cancel")}
        </button>
      )}

      {!embedded && (
        <h2 className="flea-scene-form__title">{t("registration.formTitle")}</h2>
      )}

      {table && (
        <div className="flea-paper-card flea-scene-form__summary-card">
          <p className="flea-scene-form__summary-meta">{STANDARD_TABLE_SIZE_LABEL}</p>
          {tableHasClothingRack(table.id) && (
            <p className="flea-scene-form__summary-meta">
              <span aria-hidden>🧥</span> {t("table.detailsRack")}
            </p>
          )}
        </div>
      )}

      <div className="flea-paper-card flea-scene-form__info-card">
        <p>{t("policy.oneApartmentRule")}</p>
        <p>{renderWithContact(t("policy.noSelfUnregister"), { color: colors.fleaTerracottaDark, fontWeight: 600 })}</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="flea-scene-form__field">
          <label htmlFor="reg-name" className="flea-scene-form__label">
            {t("registration.nameLabel")} *
          </label>
          <input
            id="reg-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flea-scene-form__input"
          />
        </div>

        <div className="flea-scene-form__field">
          <label htmlFor="reg-email" className="flea-scene-form__label">
            {t("registration.emailLabel")} *
          </label>
          <input
            id="reg-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flea-scene-form__input"
          />
        </div>

        <div className="flea-scene-form__field">
          <label htmlFor="reg-street" className="flea-scene-form__label">
            {t("registration.streetLabel")}
          </label>
          <input
            id="reg-street"
            type="text"
            value={ELIGIBLE_STREET}
            disabled
            className="flea-scene-form__input"
          />
        </div>

        <div className="flea-scene-form__field">
          <label htmlFor="reg-house" className="flea-scene-form__label">
            {t("registration.houseNumberLabel")} *
          </label>
          <input
            id="reg-house"
            type="number"
            required
            min={HOUSE_NUMBER_MIN}
            max={HOUSE_NUMBER_MAX}
            value={houseNumber}
            onChange={(e) => setHouseNumber(e.target.value)}
            className="flea-scene-form__input"
          />
        </div>

        {needsUnitFields && (
          <>
            <div className="flea-scene-form__field">
              <label htmlFor="reg-floor" className="flea-scene-form__label">
                {t("registration.floorLabel")} *
              </label>
              <input
                id="reg-floor"
                type="text"
                required
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                className="flea-scene-form__input"
              />
            </div>
            <div className="flea-scene-form__field">
              <label htmlFor="reg-door" className="flea-scene-form__label">
                {t("registration.doorLabel")}
              </label>
              <input
                id="reg-door"
                type="text"
                value={door}
                onChange={(e) => setDoor(e.target.value)}
                className="flea-scene-form__input"
              />
            </div>
          </>
        )}

        <fieldset className="flea-scene-form__fieldset">
          <legend className="flea-scene-form__legend">{t("consent.title")}</legend>

          <ul className="flea-scene-form__consent-list">
            <li>{t("consent.dataCollected")}</li>
            <li>{t("consent.purpose")}</li>
            <li>{t("consent.retention")}</li>
            <li>
              {t("consent.contact")} <a href={`mailto:${EVENT_CONTACT.email}`}>{EVENT_CONTACT.name}</a>.
            </li>
          </ul>

          <label className="flea-scene-form__consent-row">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              style={{ marginTop: "0.2rem" }}
            />
            <span>{t("consent.acknowledgment")}</span>
          </label>
        </fieldset>

        {errors.length > 0 && (
          <div role="alert" style={{ ...alertError, marginBottom: "1rem" }}>
            {errors.map((err) => (
              <p key={err} style={{ margin: "0.25rem 0" }}>
                {err}
              </p>
            ))}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flea-scene-cta flea-scene-cta--full"
        >
          {submitting ? t("common.loading") : t("table.bookNow")}
        </button>
      </form>
    </section>
  );
}
