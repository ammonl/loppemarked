"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { colors, fonts } from "@/styles/theme";

type Audience = "all";
type Tab = "preview" | "source";

interface RecipientInfo {
  count: number;
  recipients: { email: string; name: string; language: string }[];
}

const DEFAULT_AUDIENCE: Audience = "all";

function makeTabStyle(tab: Tab, activeTab: Tab): React.CSSProperties {
  const isActive = tab === activeTab;
  return {
    padding: "0.4rem 1rem",
    border: "none",
    borderBottom: isActive ? `2px solid ${colors.sage}` : "2px solid transparent",
    background: "none",
    cursor: "pointer",
    fontSize: "0.8rem",
    fontFamily: fonts.body,
    fontWeight: isActive ? 600 : 400,
    color: isActive ? colors.sageDark : colors.warmBrown,
  };
}

interface EditorSectionProps {
  idPrefix: string;
  subjectLabel: string;
  bodyLabel: string;
  previewLabel: string;
  sourceLabel: string;
  subject: string;
  bodyHtml: string;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  heading?: string;
  previewLanguage: string;
  defaultBody?: string;
  resetLabel?: string;
  onReset?: () => void;
}

function EditorSection({
  idPrefix,
  subjectLabel,
  bodyLabel,
  previewLabel,
  sourceLabel,
  subject,
  bodyHtml,
  onSubjectChange,
  onBodyChange,
  heading,
  previewLanguage,
  defaultBody,
  resetLabel,
  onReset,
}: EditorSectionProps) {
  const [activeTab, setActiveTab] = useState<Tab>("source");
  const [previewHtml, setPreviewHtml] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    if (activeTab !== "preview" || !bodyHtml.trim()) return;

    let cancelled = false;
    setLoadingPreview(true);

    fetch("/admin/messaging/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ bodyHtml, subject, language: previewLanguage }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) {
          setPreviewHtml(data?.previewHtml ?? bodyHtml);
        }
      })
      .catch(() => {
        if (!cancelled) setPreviewHtml(bodyHtml);
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, bodyHtml, subject, previewLanguage]);

  return (
    <div
      style={{
        border: `1px solid ${colors.borderTan}`,
        borderRadius: 6,
        padding: "1rem",
        background: colors.parchment,
        marginBottom: "1rem",
      }}
    >
      {heading && (
        <h3
          style={{
            fontSize: "0.9rem",
            fontWeight: 600,
            color: colors.warmBrown,
            marginBottom: "0.75rem",
            marginTop: 0,
          }}
        >
          {heading}
        </h3>
      )}

      <div style={{ marginBottom: "0.75rem" }}>
        <label
          htmlFor={`${idPrefix}-subject`}
          style={{
            display: "block",
            fontSize: "0.8rem",
            fontWeight: 600,
            marginBottom: "0.25rem",
            color: colors.warmBrown,
          }}
        >
          {subjectLabel}
        </label>
        <input
          id={`${idPrefix}-subject`}
          type="text"
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          style={{
            width: "100%",
            padding: "0.4rem",
            border: `1px solid ${colors.borderTan}`,
            borderRadius: 4,
            fontSize: "0.85rem",
            fontFamily: fonts.body,
            boxSizing: "border-box",
            color: colors.inkBrown,
            background: colors.white,
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          borderBottom: `1px solid ${colors.borderTan}`,
          marginBottom: "0.5rem",
        }}
      >
        <div role="tablist" style={{ display: "flex", flex: 1 }}>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "preview"}
            onClick={() => setActiveTab("preview")}
            style={makeTabStyle("preview", activeTab)}
          >
            {previewLabel}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "source"}
            onClick={() => setActiveTab("source")}
            style={makeTabStyle("source", activeTab)}
          >
            {sourceLabel}
          </button>
        </div>
        {defaultBody && onReset && resetLabel && (
          <button
            type="button"
            onClick={onReset}
            style={{
              padding: "0.25rem 0.5rem",
              border: `1px solid ${colors.borderTan}`,
              borderRadius: 4,
              background: "none",
              cursor: "pointer",
              fontSize: "0.75rem",
              fontFamily: fonts.body,
              color: colors.warmBrown,
              marginBottom: "0.25rem",
            }}
          >
            {resetLabel}
          </button>
        )}
      </div>

      {activeTab === "preview" && (
        <div role="tabpanel" style={{ marginBottom: "0.5rem" }}>
          {loadingPreview ? (
            <div style={{ padding: "1rem", textAlign: "center", fontSize: "0.85rem", color: colors.warmBrown }}>
              Loading...
            </div>
          ) : (
            <iframe
              title={previewLabel}
              srcDoc={previewHtml || bodyHtml}
              sandbox=""
              style={{
                width: "100%",
                height: 300,
                border: `1px solid ${colors.borderTan}`,
                borderRadius: 4,
                background: colors.white,
              }}
            />
          )}
        </div>
      )}

      {activeTab === "source" && (
        <div role="tabpanel" style={{ marginBottom: "0.5rem" }}>
          <textarea
            aria-label={bodyLabel}
            value={bodyHtml}
            onChange={(e) => onBodyChange(e.target.value)}
            rows={12}
            style={{
              width: "100%",
              padding: "0.4rem",
              border: `1px solid ${colors.borderTan}`,
              borderRadius: 4,
              fontSize: "0.8rem",
              fontFamily: "monospace",
              resize: "vertical",
              boxSizing: "border-box",
              color: colors.inkBrown,
              background: colors.white,
            }}
          />
        </div>
      )}
    </div>
  );
}

export function AdminMessaging() {
  const { t, language } = useLanguage();
  const audience: Audience = DEFAULT_AUDIENCE;
  const [recipientInfo, setRecipientInfo] = useState<RecipientInfo | null>(null);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [bilingual, setBilingual] = useState(false);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [subjectDa, setSubjectDa] = useState("");
  const [bodyHtmlDa, setBodyHtmlDa] = useState("");
  const [subjectEn, setSubjectEn] = useState("");
  const [bodyHtmlEn, setBodyHtmlEn] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const defaultBodyRef = useRef("");
  const defaultBodyDaRef = useRef("");
  const defaultBodyEnRef = useRef("");

  const langCounts = useMemo(() => {
    if (!recipientInfo) return { en: 0, da: 0 };
    let en = 0;
    let da = 0;
    for (const r of recipientInfo.recipients) {
      if (r.language === "en") en++;
      else if (r.language === "da") da++;
    }
    return { en, da };
  }, [recipientInfo]);

  const fetchRecipients = useCallback(async (aud: Audience) => {
    setLoadingRecipients(true);
    setError("");
    try {
      const res = await fetch("/admin/messaging/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ audience: aud }),
      });
      if (res.ok) {
        const data = await res.json();
        setRecipientInfo({ count: data.count, recipients: data.recipients });
      } else {
        setRecipientInfo(null);
      }
    } catch {
      setRecipientInfo(null);
    } finally {
      setLoadingRecipients(false);
    }
  }, []);

  useEffect(() => {
    fetchRecipients(audience);
  }, [audience, fetchRecipients]);

  const initialLanguage = useRef(language);

  useEffect(() => {
    async function loadTemplates() {
      try {
        const [singleRes, daRes, enRes] = await Promise.all([
          fetch("/admin/messaging/template", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ language: initialLanguage.current }),
          }),
          fetch("/admin/messaging/template", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ language: "da" }),
          }),
          fetch("/admin/messaging/template", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ language: "en" }),
          }),
        ]);

        if (singleRes.ok) {
          const data = await singleRes.json();
          defaultBodyRef.current = data.defaultBody;
          setBodyHtml(data.defaultBody);
        }
        if (daRes.ok) {
          const data = await daRes.json();
          defaultBodyDaRef.current = data.defaultBody;
          setBodyHtmlDa(data.defaultBody);
        }
        if (enRes.ok) {
          const data = await enRes.json();
          defaultBodyEnRef.current = data.defaultBody;
          setBodyHtmlEn(data.defaultBody);
        }
      } catch {
        // Templates are optional; the form works without them
      }
    }
    loadTemplates();
  }, []);

  function resetToTemplate() {
    setBodyHtml(defaultBodyRef.current);
  }

  function resetToTemplateDa() {
    setBodyHtmlDa(defaultBodyDaRef.current);
  }

  function resetToTemplateEn() {
    setBodyHtmlEn(defaultBodyEnRef.current);
  }

  function clearForm() {
    setSubject("");
    setBodyHtml(defaultBodyRef.current);
    setSubjectDa("");
    setBodyHtmlDa(defaultBodyDaRef.current);
    setSubjectEn("");
    setBodyHtmlEn(defaultBodyEnRef.current);
  }

  async function handleSend() {
    setError("");
    setSuccess("");

    if (bilingual) {
      if (!subjectDa.trim()) {
        setError(t("admin.messaging.subjectDaRequired"));
        return;
      }
      if (!bodyHtmlDa.trim()) {
        setError(t("admin.messaging.bodyDaRequired"));
        return;
      }
      if (!subjectEn.trim()) {
        setError(t("admin.messaging.subjectEnRequired"));
        return;
      }
      if (!bodyHtmlEn.trim()) {
        setError(t("admin.messaging.bodyEnRequired"));
        return;
      }
    } else {
      if (!subject.trim()) {
        setError(t("admin.messaging.subjectRequired"));
        return;
      }
      if (!bodyHtml.trim()) {
        setError(t("admin.messaging.bodyRequired"));
        return;
      }
    }

    if (!recipientInfo || recipientInfo.count === 0) {
      setError(t("admin.messaging.noRecipients"));
      return;
    }

    const confirmMsg = `${t("admin.messaging.confirmSend")} ${recipientInfo.count} ${t("admin.messaging.recipientCount")} (${langCounts.en} ${t("admin.messaging.englishCount")}, ${langCounts.da} ${t("admin.messaging.danishCount")})?`;
    if (!window.confirm(confirmMsg)) return;

    setSending(true);
    try {
      const payload = bilingual
        ? { audience, bilingual: true, subjectDa, bodyHtmlDa, subjectEn, bodyHtmlEn }
        : { audience, subject, bodyHtml };

      const res = await fetch("/admin/messaging/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setSuccess(
          `${t("admin.messaging.sent")} (${data.queuedCount}/${data.recipientCount})`,
        );
        clearForm();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? t("admin.messaging.failed"));
      }
    } catch {
      setError(t("admin.messaging.failed"));
    } finally {
      setSending(false);
    }
  }

  const hasTemplates = defaultBodyRef.current || defaultBodyDaRef.current || defaultBodyEnRef.current;

  return (
    <div style={{ fontFamily: fonts.body, color: colors.inkBrown }}>
      <h2 style={{ fontSize: "1.1rem", color: colors.warmBrown, marginBottom: "1rem" }}>
        {t("admin.messaging.title")}
      </h2>

      <div
        style={{
          border: `1px solid ${colors.borderTan}`,
          borderRadius: 6,
          padding: "1rem",
          background: colors.parchment,
          marginBottom: "1rem",
        }}
      >
        <div
          style={{
            fontSize: "0.85rem",
            fontWeight: 600,
            marginBottom: "0.5rem",
            color: colors.warmBrown,
          }}
        >
          {t("admin.messaging.audience")}
        </div>

        <p style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", color: colors.inkBrown }}>
          {t("admin.messaging.audienceAll")}
        </p>

        <div
          style={{
            marginTop: "0.75rem",
            padding: "0.5rem 0.75rem",
            background: colors.infoBg,
            border: `1px solid ${colors.skyMist}`,
            borderRadius: 4,
            fontSize: "0.85rem",
            color: colors.infoText,
          }}
        >
          {loadingRecipients
            ? t("common.loading")
            : recipientInfo
              ? `${recipientInfo.count} ${t("admin.messaging.recipientCount")} (${langCounts.en} ${t("admin.messaging.englishCount")}, ${langCounts.da} ${t("admin.messaging.danishCount")})`
              : "—"}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "1rem",
          padding: "0.5rem 0.75rem",
          background: colors.parchment,
          border: `1px solid ${colors.borderTan}`,
          borderRadius: 6,
        }}
      >
        <input
          id="bilingual-toggle"
          type="checkbox"
          checked={bilingual}
          onChange={(e) => setBilingual(e.target.checked)}
          style={{ cursor: "pointer" }}
        />
        <label
          htmlFor="bilingual-toggle"
          style={{ fontSize: "0.85rem", fontWeight: 600, color: colors.warmBrown, cursor: "pointer" }}
        >
          {t("admin.messaging.bilingual")}
        </label>
        <span style={{ fontSize: "0.8rem", color: colors.warmBrown, marginLeft: "0.25rem" }}>
          — {t("admin.messaging.bilingualHint")}
        </span>
      </div>

      {bilingual ? (
        <>
          <EditorSection
            idPrefix="messaging-da"
            heading={t("admin.messaging.danishVersion")}
            subjectLabel={t("admin.messaging.subject")}
            bodyLabel={`${t("admin.messaging.body")} (DA)`}
            previewLabel={t("admin.messaging.preview")}
            sourceLabel={t("admin.messaging.source")}
            subject={subjectDa}
            bodyHtml={bodyHtmlDa}
            onSubjectChange={setSubjectDa}
            onBodyChange={setBodyHtmlDa}
            previewLanguage="da"
            defaultBody={defaultBodyDaRef.current}
            resetLabel={t("admin.messaging.resetTemplate")}
            onReset={resetToTemplateDa}
          />
          <EditorSection
            idPrefix="messaging-en"
            heading={t("admin.messaging.englishVersion")}
            subjectLabel={t("admin.messaging.subject")}
            bodyLabel={`${t("admin.messaging.body")} (EN)`}
            previewLabel={t("admin.messaging.preview")}
            sourceLabel={t("admin.messaging.source")}
            subject={subjectEn}
            bodyHtml={bodyHtmlEn}
            onSubjectChange={setSubjectEn}
            onBodyChange={setBodyHtmlEn}
            previewLanguage="en"
            defaultBody={defaultBodyEnRef.current}
            resetLabel={t("admin.messaging.resetTemplate")}
            onReset={resetToTemplateEn}
          />
        </>
      ) : (
        <EditorSection
          idPrefix="messaging"
          subjectLabel={t("admin.messaging.subject")}
          bodyLabel={t("admin.messaging.body")}
          previewLabel={t("admin.messaging.preview")}
          sourceLabel={t("admin.messaging.source")}
          subject={subject}
          bodyHtml={bodyHtml}
          onSubjectChange={setSubject}
          onBodyChange={setBodyHtml}
          previewLanguage={language}
          defaultBody={defaultBodyRef.current}
          resetLabel={t("admin.messaging.resetTemplate")}
          onReset={resetToTemplate}
        />
      )}

      {hasTemplates && (
        <p
          style={{
            fontSize: "0.75rem",
            color: colors.warmBrown,
            margin: "-0.5rem 0 0.75rem",
            fontStyle: "italic",
          }}
        >
          {t("admin.messaging.templateHint")}
        </p>
      )}

      {error && (
        <p
          role="alert"
          style={{
            fontSize: "0.85rem",
            color: colors.errorText,
            background: colors.errorBg,
            border: `1px solid ${colors.dustyRose}`,
            borderRadius: 4,
            padding: "0.5rem 0.75rem",
            marginBottom: "0.75rem",
          }}
        >
          {error}
        </p>
      )}

      {success && (
        <p
          role="status"
          style={{
            fontSize: "0.85rem",
            color: colors.sageDark,
            background: colors.lightSage,
            border: `1px solid ${colors.sage}`,
            borderRadius: 4,
            padding: "0.5rem 0.75rem",
            marginBottom: "0.75rem",
          }}
        >
          {success}
        </p>
      )}

      <button
        type="button"
        onClick={handleSend}
        disabled={sending}
        style={{
          padding: "0.5rem 1.25rem",
          background: sending ? colors.borderTan : colors.sage,
          color: colors.white,
          border: "none",
          borderRadius: 6,
          fontSize: "0.9rem",
          fontWeight: 600,
          fontFamily: fonts.body,
          cursor: sending ? "progress" : "pointer",
        }}
      >
        {sending ? t("admin.messaging.sending") : t("admin.messaging.send")}
      </button>
    </div>
  );
}
