import { Body, Container, Head, Html, Link, Preview, Section, Text } from '@react-email/components';
import type * as React from 'react';

interface EmailLayoutProps {
  locale: string;
  preview: string;
  brandName: string;
  footer: string;
  heroLabel?: string;
  children: React.ReactNode;
}

export function EmailLayout({
  locale,
  preview,
  brandName,
  footer,
  heroLabel,
  children,
}: EmailLayoutProps) {
  return (
    <Html lang={locale}>
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
        <style>{responsiveStyles}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container className="email-wrap" style={wrapper}>
          <Section style={brandSection}>
            <Text style={brand}>{brandName}</Text>
          </Section>

          <Section style={card}>
            {heroLabel ? (
              <Section style={hero}>
                <Text style={heroText}>{heroLabel}</Text>
              </Section>
            ) : (
              <Section style={accent}>
                <Text style={accentSpacer}>&nbsp;</Text>
              </Section>
            )}
            {children}
          </Section>

          <Section className="email-px" style={footerSection}>
            <Text style={footerText}>{footer}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function Divider() {
  return (
    <Section style={dividerSection}>
      <Text style={divider}>&nbsp;</Text>
    </Section>
  );
}

export function FallbackLink({ label, url }: { label: string; url: string }) {
  return (
    <Text style={fallbackText}>
      {label}
      <br />
      <Link href={url} style={link}>
        {url}
      </Link>
    </Text>
  );
}

const responsiveStyles = `
  @media only screen and (max-width: 620px) {
    .email-wrap { width: 100% !important; }
    .email-px { padding-left: 24px !important; padding-right: 24px !important; }
    .email-heading { font-size: 22px !important; line-height: 29px !important; }
    .email-button { display: block !important; text-align: center !important; }
  }
`;

export const fontFamily =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif';

const main: React.CSSProperties = {
  margin: 0,
  padding: '40px 16px',
  backgroundColor: '#F6F5F3',
  color: '#292929',
  fontFamily,
};

const wrapper: React.CSSProperties = {
  width: '600px',
  maxWidth: '600px',
  margin: '0 auto',
};

const brandSection: React.CSSProperties = { padding: '0 8px 20px' };

const brand: React.CSSProperties = {
  margin: 0,
  color: '#292929',
  fontFamily,
  fontSize: '14px',
  fontWeight: 500,
  letterSpacing: '-0.15px',
  lineHeight: '19px',
};

const card: React.CSSProperties = {
  overflow: 'hidden',
  backgroundColor: '#FFFFFF',
  border: '1px solid #E6E4E0',
  borderRadius: '16px',
};

const accent: React.CSSProperties = {
  height: '6px',
  backgroundColor: '#C9B8FF',
  backgroundImage: 'linear-gradient(90deg,#A7C7FF 0%,#C9B8FF 42%,#FFB6D9 78%,#FFD98A 100%)',
};

const accentSpacer: React.CSSProperties = {
  height: '6px',
  margin: 0,
  fontSize: '6px',
  lineHeight: '6px',
};

const hero: React.CSSProperties = {
  height: '112px',
  backgroundColor: '#C9B8FF',
  backgroundImage: 'linear-gradient(135deg,#A7C7FF 0%,#C9B8FF 42%,#FFB6D9 78%,#FFD98A 100%)',
  textAlign: 'center',
  verticalAlign: 'middle',
};

const heroText: React.CSSProperties = {
  margin: 0,
  padding: '47px 16px',
  color: '#292929',
  fontFamily,
  fontSize: '13px',
  fontWeight: 500,
  letterSpacing: '-0.15px',
  lineHeight: '18px',
};

const footerSection: React.CSSProperties = { padding: '22px 8px 0' };

const footerText: React.CSSProperties = {
  margin: 0,
  color: '#9E9E9E',
  fontFamily,
  fontSize: '12px',
  letterSpacing: '-0.15px',
  lineHeight: '19px',
  whiteSpace: 'pre-line',
};

const dividerSection: React.CSSProperties = { padding: '24px 40px 0' };

const divider: React.CSSProperties = {
  height: '1px',
  margin: 0,
  backgroundColor: '#EDEBE8',
  fontSize: '1px',
  lineHeight: '1px',
};

const fallbackText: React.CSSProperties = {
  margin: 0,
  color: '#9E9E9E',
  fontFamily,
  fontSize: '12px',
  letterSpacing: '-0.15px',
  lineHeight: '19px',
};

export const link: React.CSSProperties = {
  color: '#2F80F6',
  textDecoration: 'none',
  wordBreak: 'break-all',
};

export const heading: React.CSSProperties = {
  margin: '0 0 10px',
  color: '#292929',
  fontFamily,
  fontSize: '24px',
  fontWeight: 500,
  letterSpacing: '-0.3px',
  lineHeight: '31px',
};

export const bodyText: React.CSSProperties = {
  margin: 0,
  color: '#5D5D5D',
  fontFamily,
  fontSize: '14px',
  letterSpacing: '-0.15px',
  lineHeight: '22px',
};

export const mutedText: React.CSSProperties = {
  margin: 0,
  color: '#9E9E9E',
  fontFamily,
  fontSize: '13px',
  letterSpacing: '-0.15px',
  lineHeight: '20px',
};

export const primaryButton: React.CSSProperties = {
  display: 'inline-block',
  padding: '13px 30px',
  backgroundColor: '#2A2926',
  borderRadius: '999px',
  color: '#FFFFFF',
  fontFamily,
  fontSize: '14px',
  fontWeight: 500,
  letterSpacing: '-0.15px',
  lineHeight: '18px',
  textAlign: 'center',
  textDecoration: 'none',
};
