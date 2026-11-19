import { Fragment, type ReactNode } from 'react';
import { Navbar } from '@/components/navigation/Navbar';
import { Footer } from '@/components/layout/Footer';
import { websiteHref } from '@/lib/platform/domains';
import { legalBlocks } from '@/lib/legal/document';
import '@/styles/legal.css';

function inline(text: string): ReactNode[] {
  return text
    .split(
      /(\*\*[^*]+\*\*|care@mentoralm\.com|\+91 8147319393|mentoralm\.com)/g,
    )
    .map((part, index) => {
      if (part.startsWith('**'))
        return <strong key={index}>{inline(part.slice(2, -2))}</strong>;
      const href =
        part === 'care@mentoralm.com'
          ? 'mailto:care@mentoralm.com'
          : part === '+91 8147319393'
            ? 'tel:+918147319393'
            : part === 'mentoralm.com'
              ? 'https://mentoralm.com'
              : null;
      return href ? (
        <a key={index} href={href}>
          {part}
        </a>
      ) : (
        <Fragment key={index}>{part}</Fragment>
      );
    });
}
export function LegalDocument({ markdown }: { markdown: string }) {
  const homeHref = websiteHref('/');
  return (
    <div className="legal-page" id="top">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Navbar homeHref={homeHref} />
      <main id="main-content" className="legal-main">
        <article className="legal-document">
          {legalBlocks(markdown).map((block, index) => {
            if (block.kind === 'heading') {
              const Heading =
                block.level === 1 ? 'h1' : block.level === 2 ? 'h2' : 'h3';
              return <Heading key={index}>{inline(block.text)}</Heading>;
            }
            if (block.kind === 'list') {
              const List = block.ordered ? 'ol' : 'ul';
              return (
                <List key={index}>
                  {block.items.map((item, i) => (
                    <li key={i}>{inline(item)}</li>
                  ))}
                </List>
              );
            }
            return <p key={index}>{inline(block.text)}</p>;
          })}
        </article>
      </main>
      <Footer homeHref={homeHref} />
    </div>
  );
}
