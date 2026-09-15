import { Button, Heading, Section, Text } from '@react-email/components';
import type * as React from 'react';
import type { ActionEmailParams } from '../email.service';
import {
  bodyText,
  Divider,
  EmailLayout,
  FallbackLink,
  fontFamily,
  heading,
  mutedText,
  primaryButton,
} from './email-layout';

export function ActionEmail(params: ActionEmailParams) {
  return (
    <EmailLayout
      locale={params.locale}
      preview={params.preview}
      brandName={params.brandName}
      footer={params.footer}
    >
      <Section className="email-px" style={introSection}>
        <Heading className="email-heading" style={heading}>
          {params.heading}
        </Heading>
        <Text style={bodyText}>{params.body}</Text>
      </Section>

      {params.recipientEmail ? (
        <Section className="email-px" style={emailSection}>
          <Text style={emailBox}>{params.recipientEmail}</Text>
        </Section>
      ) : null}

      <Section className="email-px" style={buttonSection}>
        <Button className="email-button" style={primaryButton} href={params.url}>
          {params.actionLabel}
        </Button>
      </Section>

      <Section className="email-px" style={helperSection}>
        <Text style={mutedText}>{params.helperText}</Text>
      </Section>

      <Divider />

      <Section className="email-px" style={closingSection}>
        <Text style={closingText}>{params.closingText}</Text>
        <FallbackLink label={params.fallbackLabel} url={params.url} />
      </Section>
    </EmailLayout>
  );
}

const introSection: React.CSSProperties = { padding: '36px 40px 0' };
const emailSection: React.CSSProperties = { padding: '18px 40px 0' };
const buttonSection: React.CSSProperties = { padding: '24px 40px 0' };
const helperSection: React.CSSProperties = { padding: '20px 40px 0' };
const closingSection: React.CSSProperties = { padding: '20px 40px 36px' };

const emailBox: React.CSSProperties = {
  margin: 0,
  padding: '11px 14px',
  backgroundColor: '#F1F0EE',
  border: '1px solid #E6E4E0',
  borderRadius: '8px',
  color: '#292929',
  fontFamily,
  fontSize: '13px',
  letterSpacing: '-0.15px',
  lineHeight: '18px',
};

const closingText: React.CSSProperties = {
  ...bodyText,
  margin: '0 0 8px',
  fontSize: '13px',
  lineHeight: '20px',
};
