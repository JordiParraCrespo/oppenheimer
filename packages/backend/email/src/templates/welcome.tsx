import { Heading, Section, Text } from '@react-email/components';
import type * as React from 'react';
import type { WelcomeEmailParams } from '../email.service';
import { bodyText, Divider, EmailLayout, fontFamily, heading } from './email-layout';

export function WelcomeEmail(params: WelcomeEmailParams) {
  return (
    <EmailLayout
      locale={params.locale}
      preview={params.preview}
      brandName={params.brandName}
      footer={params.footer}
    >
      <Section className="email-px" style={eyebrowSection}>
        <Text style={eyebrow}>{params.eyebrow}</Text>
      </Section>
      <Section className="email-px" style={introSection}>
        <Heading className="email-heading" style={heading}>
          {params.heading}
        </Heading>
        <Text style={greeting}>{params.greeting}</Text>
        <Text style={bodyText}>{params.body}</Text>
      </Section>
      <Divider />
      <Section className="email-px" style={closingSection}>
        <Text style={supportText}>{params.supportText}</Text>
        <Text style={signoff}>{params.signoff}</Text>
      </Section>
    </EmailLayout>
  );
}

const eyebrowSection: React.CSSProperties = { padding: '32px 40px 0' };
const introSection: React.CSSProperties = { padding: '16px 40px 0' };
const closingSection: React.CSSProperties = { padding: '20px 40px 36px' };

const eyebrow: React.CSSProperties = {
  display: 'inline-block',
  margin: 0,
  padding: '5px 12px',
  backgroundColor: '#EAF2FE',
  border: '1px solid #D3E4FC',
  borderRadius: '999px',
  color: '#2F80F6',
  fontFamily,
  fontSize: '12px',
  fontWeight: 500,
  letterSpacing: '-0.15px',
  lineHeight: '16px',
};

const greeting: React.CSSProperties = { ...bodyText, margin: '0 0 8px', color: '#292929' };
const supportText: React.CSSProperties = { ...bodyText, margin: '0 0 12px', fontSize: '13px' };
const signoff: React.CSSProperties = { ...bodyText, color: '#9E9E9E', fontSize: '13px' };
