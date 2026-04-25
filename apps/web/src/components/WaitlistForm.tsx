"use client";

import { useState } from "react";
import {
  ELIGIBLE_STREET,
  HOUSE_NUMBER_MIN,
  HOUSE_NUMBER_MAX,
  EVENT_CONTACT,
  isFloorDoorRequired,
  validateWaitlistInput,
  type Language,
} from "@loppemarked/shared";
import { useLanguage } from "@/i18n/LanguageProvider";
import { alertError } from "@/styles/theme";
import { WaitlistBanner } from "./WaitlistBanner";
import "@/styles/table-map.css";

interface WaitlistFormProps {
  onCancel: () => void;
}

export function WaitlistForm({ onCancel }: WaitlistFormProps) {
  const { language, t } = useLanguage();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [floor, setFloor] = useState("");
  const [door, setDoor] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    | { kind: "joined"; alreadyOnWaitlist: boolean; position: number; joinedAt?: string }
    | { kind: "alreadyHasTable" }
    | null
  >(null);

  const parsedHouseNumber = parseInt(houseNumber, 10);
  const needsFloorDoor = !isNaN(parsedHouseNumber) && isFloorDoorRequired(parsedHouseNumber);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);

    if (!consentChecked) {
      setErrors([t("consent.required")]);
      return;
    }

    // Drop floor/door from the payload when the house number doesn't require
    // them. Otherwise stale values (typed for a previous house number) would
    // leak through and corrupt the apartment dedupe key.
    const input = {
      name: name.trim(),
      email: email.trim(),
      street: ELIGIBLE_STREET,
      houseNumber: parsedHouseNumber,
      floor: needsFloorDoor ? floor.trim() || null : null,
      door: needsFloorDoor ? door.trim() || null : null,
      language: language as Language,
      // Flea market has a single hall — send the any-preference default
      // to the existing API contract without exposing a pointless selector.
      greenhousePreference: "any" as const,
    };

    const validation = validateWaitlistInput(input);
    if (!validation.valid) {
      const fieldErrors: string[] = [];
      if (validation.errors["name"]) fieldErrors.push(t("validation.nameRequired"));
      if (validation.errors["email"]) {
        const isRequired = validation.errors["email"].toLowerCase().includes("required");
        fieldErrors.push(t(isRequired ? "validation.emailRequired" : "validation.emailInvalid"));
      }
      if (validation.errors["houseNumber"]) fieldErrors.push(t("validation.houseNumberInvalid"));
      if (validation.errors["floorDoor"]) fieldErrors.push(t("validation.floorDoorRequired"));
      setErrors(fieldErrors.length > 0 ? fieldErrors : [t("common.error")]);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/public/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 409 && body?.code === "APARTMENT_HAS_REGISTRATION") {
          setResult({ kind: "alreadyHasTable" });
          return;
        }
        setErrors([body?.error ?? t("common.error")]);
        return;
      }

      setResult({
        kind: "joined",
        alreadyOnWaitlist: body.alreadyOnWaitlist ?? false,
        position: body.position ?? 0,
        joinedAt: body.joinedAt,
      });
    } catch {
      setErrors([t("common.error")]);
    } finally {
      setSubmitting(false);
    }
  }

  if (result?.kind === "alreadyHasTable") {
    return (
      <section className="flea-scene-form">
        <h2 className="flea-scene-form__success-title">
          {t("waitlist.alreadyHasTableTitle")}
        </h2>
        <p className="flea-scene-form__subtitle">
          {t("waitlist.alreadyHasTableBody")}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="flea-scene-cta flea-scene-cta--mt-lg"
        >
          {t("common.close")}
        </button>
      </section>
    );
  }

  if (result?.kind === "joined") {
    return (
      <section className="flea-scene-form">
        <h2 className="flea-scene-form__success-title">{t("waitlist.success")}</h2>
        <WaitlistBanner position={result.position} alreadyOnWaitlist={result.alreadyOnWaitlist} />
        <button
          type="button"
          onClick={onCancel}
          className="flea-scene-cta flea-scene-cta--mt-lg"
        >
          {t("common.close")}
        </button>
      </section>
    );
  }

  return (
    <section className="flea-scene-form">
      <button type="button" onClick={onCancel} className="flea-scene-form__back">
        &larr; {t("common.cancel")}
      </button>

      <h2 className="flea-scene-form__title">{t("waitlist.title")}</h2>
      <p className="flea-scene-form__subtitle">{t("waitlist.description")}</p>

      <form onSubmit={handleSubmit}>
        <div className="flea-scene-form__field">
          <label htmlFor="wl-name" className="flea-scene-form__label">
            {t("registration.nameLabel")} *
          </label>
          <input
            id="wl-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flea-scene-form__input"
          />
        </div>

        <div className="flea-scene-form__field">
          <label htmlFor="wl-email" className="flea-scene-form__label">
            {t("registration.emailLabel")} *
          </label>
          <input
            id="wl-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flea-scene-form__input"
          />
        </div>

        <div className="flea-scene-form__field">
          <label htmlFor="wl-street" className="flea-scene-form__label">
            {t("registration.streetLabel")}
          </label>
          <input
            id="wl-street"
            type="text"
            value={ELIGIBLE_STREET}
            disabled
            className="flea-scene-form__input"
          />
        </div>

        <div className="flea-scene-form__field">
          <label htmlFor="wl-house" className="flea-scene-form__label">
            {t("registration.houseNumberLabel")} *
          </label>
          <input
            id="wl-house"
            type="number"
            required
            min={HOUSE_NUMBER_MIN}
            max={HOUSE_NUMBER_MAX}
            value={houseNumber}
            onChange={(e) => setHouseNumber(e.target.value)}
            className="flea-scene-form__input"
          />
        </div>

        {needsFloorDoor && (
          <>
            <div className="flea-scene-form__field">
              <label htmlFor="wl-floor" className="flea-scene-form__label">
                {t("registration.floorLabel")} *
              </label>
              <input
                id="wl-floor"
                type="text"
                required
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                className="flea-scene-form__input"
              />
            </div>
            <div className="flea-scene-form__field">
              <label htmlFor="wl-door" className="flea-scene-form__label">
                {t("registration.doorLabel")}
              </label>
              <input
                id="wl-door"
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
          {submitting ? t("common.loading") : t("waitlist.joinButton")}
        </button>
      </form>
    </section>
  );
}
