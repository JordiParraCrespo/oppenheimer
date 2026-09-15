import { Button, Heading, Section, Text } from '@react-email/components';
import type * as React from 'react';
import type { InvitationEmailParams } from '../email.service';
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

export function InvitationEmail(params: InvitationEmailParams) {
  return (
    <EmailLayout
      locale={params.locale}
      preview={params.preview}
      brandName={params.brandName}
      footer={params.footer}
      heroLabel={params.heroLabel}
    >
      <Section className="email-px" style={introSection}>
        <Heading className="email-heading" style={heading}>
          {params.heading}
        </Heading>
        <Text style={bodyText}>{params.body}</Text>
      </Section>

      <Section className="email-px" style={inviterSection}>
        <table role="presentation" cellPadding="0" cellSpacing="0" style={inviterCard}>
          <tbody>
            <tr>
              <td style={avatarCell}>
                <Text style={avatar}>{params.inviterInitials}</Text>
              </td>
              <td style={inviterCopyCell}>
                <Text style={inviterLine}>{params.inviterLine}</Text>
                <Text style={roleLine}>{params.roleLine}</Text>
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section className="email-px" style={benefitsSection}>
        <Text style={benefitsTitle}>{params.benefitsTitle}</Text>
        {params.benefits.map((benefit) => (
          <table
            key={benefit}
            role="presentation"
            cellPadding="0"
            cellSpacing="0"
            style={benefitRow}
          >
            <tbody>
              <tr>
                <td style={checkCell}>✓</td>
                <td style={benefitText}>{benefit}</td>
              </tr>
            </tbody>
          </table>
        ))}
      </Section>

      <Section className="email-px" style={buttonSection}>
        <Button className="email-button" style={primaryButton} href={params.url}>
          {params.actionLabel}
        </Button>
      </Section>

      <Section className="email-px" style={expirySection}>
        <Text style={mutedText}>{params.expiryText}</Text>
      </Section>

      <Divider />

      <Section className="email-px" style={closingSection}>
        <FallbackLink label={params.fallbackLabel} url={params.url} />
        <Text style={ignoreText}>{params.ignoreText}</Text>
      </Section>
    </EmailLayout>
  );
}

const introSection: React.CSSProperties = { padding: '32px 40px 0' };
const inviterSection: React.CSSProperties = { padding: '22px 40px 0' };
const benefitsSection: React.CSSProperties = { padding: '24px 40px 0' };
const buttonSection: React.CSSProperties = { padding: '26px 40px 0' };
const expirySection: React.CSSProperties = { padding: '18px 40px 0' };
const closingSection: React.CSSProperties = { padding: '20px 40px 36px' };

const inviterCard: React.CSSProperties = {
  width: '100%',
  border: '1px solid #E6E4E0',
  borderRadius: '12px',
};

const avatarCell: React.CSSProperties = { width: '58px', padding: '14px 0 14px 14px' };

const avatar: React.CSSProperties = {
  width: '38px',
  height: '38px',
  margin: 0,
  backgroundColor: '#7A5CFF',
  borderRadius: '19px',
  color: '#FFFFFF',
  fontFamily,
  fontSize: '14px',
  fontWeight: 500,
  lineHeight: '38px',
  textAlign: 'center',
};

const inviterCopyCell: React.CSSProperties = { padding: '14px 14px 14px 0' };
const inviterLine: React.CSSProperties = {
  margin: 0,
  color: '#292929',
  fontFamily,
  fontSize: '14px',
  fontWeight: 500,
  letterSpacing: '-0.15px',
  lineHeight: '19px',
};
const roleLine: React.CSSProperties = {
  margin: '2px 0 0',
  color: '#9E9E9E',
  fontFamily,
  fontSize: '12px',
  letterSpacing: '-0.15px',
  lineHeight: '17px',
};
const benefitsTitle: React.CSSProperties = {
  margin: '0 0 12px',
  color: '#292929',
  fontFamily,
  fontSize: '13px',
  fontWeight: 500,
  letterSpacing: '-0.15px',
  lineHeight: '18px',
};
const benefitRow: React.CSSProperties = { width: '100%', marginBottom: '8px' };
const checkCell: React.CSSProperties = {
  width: '26px',
  color: '#1F9D57',
  fontFamily,
  fontSize: '14px',
  lineHeight: '21px',
  verticalAlign: 'top',
};
const benefitText: React.CSSProperties = {
  color: '#5D5D5D',
  fontFamily,
  fontSize: '14px',
  letterSpacing: '-0.15px',
  lineHeight: '21px',
  verticalAlign: 'top',
};
const ignoreText: React.CSSProperties = { ...mutedText, marginTop: '12px' };
