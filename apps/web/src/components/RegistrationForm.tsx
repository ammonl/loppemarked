"use client";

import { useState } from "react";
import {
  ELIGIBLE_STREET,
  HOUSE_NUMBER_MIN,
  HOUSE_NUMBER_MAX,
  ORGANIZER_CONTACTS,
  getTableById,
  isFloorDoorRequired,
  validateRegistrationInput,
  type Language,
} from "@loppemarked/shared";
import { useLanguage } from "@/i18n/LanguageProvider";
import { renderWithContact } from "@/i18n/contactLink";
import { colors, fonts, shadows, alertError } from "@/styles/theme";
import { emitBookingSuccess } from "@/utils/brandEvents";
import { SwitchConfirmationDialog, type SwitchDetails } from "./SwitchConfirmationDialog";

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
    return {
      name: name.trim(),
      email: email.trim(),
      street: ELIGIBLE_STREET,
      houseNumber: parsedHouseNumber,
      floor: floor.trim() || null,
      door: door.trim() || null,
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

  if (switchDetails) {
    return (
      <section style={{ maxWidth: 560, margin: "0 auto", padding: "2rem 1rem", fontFamily: fonts.body, color: colors.inkBrown }}>
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
      <section style={{ maxWidth: 560, margin: "0 auto", padding: "2rem 1rem", fontFamily: fonts.body, color: colors.inkBrown }}>
        <h2 style={{ color: colors.sageDark, fontFamily: fonts.heading }}>{t("registration.success")}</h2>
        <p style={{ marginTop: "1rem" }}>
          {renderWithContact(t("registration.unregisterInfo"), { color: colors.sageDark, fontWeight: 600 })}
        </p>
        <button
          type="button"
          onClick={onSuccess ?? onCancel}
          style={{
            marginTop: "1.5rem",
            padding: "0.5rem 1.25rem",
            background: colors.sage,
            color: colors.white,
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontFamily: fonts.body,
            fontSize: "0.95rem",
            fontWeight: 600,
          }}
        >
          {t("common.close")}
        </button>
      </section>
    );
  }

  return (
    <section
      style={{
        maxWidth: embedded ? "100%" : 560,
        margin: "0 auto",
        padding: embedded ? 0 : "2rem 1rem",
        fontFamily: fonts.body,
        color: colors.inkBrown,
      }}
    >
      {!embedded && (
        <button
          type="button"
          onClick={onCancel}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "0.9rem",
            color: colors.warmBrown,
            padding: "0.25rem 0",
            marginBottom: "1rem",
            fontFamily: fonts.body,
          }}
        >
          &larr; {t("common.cancel")}
        </button>
      )}

      {!embedded && (
        <h2 style={{ textAlign: "center", margin: "0 0 1.25rem", fontFamily: fonts.heading, color: colors.warmBrown }}>
          {t("registration.formTitle")}
        </h2>
      )}
      {table && (
        <div
          style={{
            textAlign: embedded ? "left" : "center",
            margin: embedded ? "0 0 1rem" : "0 0 1.25rem",
            background: colors.fleaNotePaper,
            border: `1px solid ${colors.fleaCork}`,
            borderRadius: 10,
            padding: "0.85rem 1rem",
          }}
        >
          <p style={{ margin: 0, fontFamily: fonts.display, fontSize: "1.5rem", color: colors.fleaTerracottaDark }}>
            {t("table.detailsTitle").replace("{number}", String(table.number))}
          </p>
          <p style={{ margin: "0.15rem 0 0", fontSize: "0.95rem", color: colors.warmBrown }}>
            {table.sizeMeters} {t("table.meters")}
          </p>
        </div>
      )}

      <div style={infoCardStyle}>
        <p style={{ margin: "0 0 0.5rem" }}>{t("policy.oneApartmentRule")}</p>
        <p style={{ margin: 0 }}>
          {renderWithContact(t("policy.noSelfUnregister"), { color: colors.sageDark, fontWeight: 600 })}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="reg-name" style={labelStyle}>
            {t("registration.nameLabel")} *
          </label>
          <input id="reg-name" type="text" required value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="reg-email" style={labelStyle}>
            {t("registration.emailLabel")} *
          </label>
          <input id="reg-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="reg-street" style={labelStyle}>
            {t("registration.streetLabel")}
          </label>
          <input id="reg-street" type="text" value={ELIGIBLE_STREET} disabled style={{ ...inputStyle, background: colors.parchmentDark, color: colors.warmBrown }} />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="reg-house" style={labelStyle}>
            {t("registration.houseNumberLabel")} *
          </label>
          <input id="reg-house" type="number" required min={HOUSE_NUMBER_MIN} max={HOUSE_NUMBER_MAX} value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} style={inputStyle} />
        </div>

        {needsUnitFields && (
          <>
            <div style={{ marginBottom: "1rem" }}>
              <label htmlFor="reg-floor" style={labelStyle}>{t("registration.floorLabel")} *</label>
              <input id="reg-floor" type="text" required value={floor} onChange={(e) => setFloor(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label htmlFor="reg-door" style={labelStyle}>{t("registration.doorLabel")}</label>
              <input id="reg-door" type="text" value={door} onChange={(e) => setDoor(e.target.value)} style={inputStyle} />
            </div>
          </>
        )}

        <fieldset
          style={{
            border: `1px solid ${colors.borderTan}`,
            borderRadius: 8,
            padding: "1rem",
            marginBottom: "1.25rem",
          }}
        >
          <legend style={{ fontWeight: 600, fontSize: "0.95rem", padding: "0 0.25rem", color: colors.warmBrown }}>
            {t("consent.title")}
          </legend>

          <ul style={{ margin: "0.5rem 0", paddingLeft: "1.25rem", fontSize: "0.9rem", lineHeight: 1.6 }}>
            <li>{t("consent.dataCollected")}</li>
            <li>{t("consent.purpose")}</li>
            <li>{t("consent.retention")}</li>
            <li>
              {t("consent.contact")}{" "}
              {ORGANIZER_CONTACTS.map((c, i) => (
                <span key={c.email}>
                  {i > 0 && ", "}
                  <a href={`mailto:${c.email}`} style={{ color: colors.sage }}>{c.name}</a>
                </span>
              ))}
            </li>
          </ul>

          <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", marginTop: "0.75rem", fontSize: "0.9rem", cursor: "pointer" }}>
            <input type="checkbox" checked={consentChecked} onChange={(e) => setConsentChecked(e.target.checked)} style={{ marginTop: "0.2rem" }} />
            <span>{t("consent.acknowledgment")}</span>
          </label>
        </fieldset>

        {errors.length > 0 && (
          <div role="alert" style={{ ...alertError, marginBottom: "1rem" }}>
            {errors.map((err) => (
              <p key={err} style={{ margin: "0.25rem 0" }}>{err}</p>
            ))}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: "100%",
            padding: "0.75rem",
            background: submitting ? colors.borderTan : colors.sage,
            color: colors.white,
            border: "none",
            borderRadius: 6,
            cursor: submitting ? "default" : "pointer",
            fontFamily: fonts.body,
            fontSize: "1rem",
            fontWeight: 600,
            boxShadow: shadows.soft,
          }}
        >
          {submitting ? t("common.loading") : t("table.bookNow")}
        </button>
      </form>
    </section>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.9rem",
  fontWeight: 500,
  marginBottom: "0.25rem",
  color: colors.warmBrown,
  fontFamily: fonts.body,
};

const infoCardStyle: React.CSSProperties = {
  background: colors.parchment,
  border: `1px solid ${colors.borderTan}`,
  borderRadius: 8,
  padding: "1rem",
  marginBottom: "1.25rem",
  fontSize: "0.9rem",
  lineHeight: 1.5,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.75rem",
  border: `1px solid ${colors.borderTan}`,
  borderRadius: 6,
  fontFamily: fonts.body,
  fontSize: "0.95rem",
  boxSizing: "border-box",
  color: colors.inkBrown,
  background: colors.white,
};
