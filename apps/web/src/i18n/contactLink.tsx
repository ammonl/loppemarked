import { Fragment, type CSSProperties, type ReactElement } from "react";
import { EVENT_CONTACT } from "@loppemarked/shared";

const CONTACT_TOKEN = "{contact}";

interface EventContactLinkProps {
  style?: CSSProperties;
  className?: string;
}

export function EventContactLink({ style, className }: EventContactLinkProps = {}): ReactElement {
  return (
    <a
      href={`mailto:${EVENT_CONTACT.email}`}
      style={style}
      className={className}
    >
      {EVENT_CONTACT.name}
    </a>
  );
}

export function renderWithContact(
  template: string,
  linkStyle?: CSSProperties,
): ReactElement {
  const parts = template.split(CONTACT_TOKEN);
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {part}
          {index < parts.length - 1 && <EventContactLink style={linkStyle} />}
        </Fragment>
      ))}
    </>
  );
}
