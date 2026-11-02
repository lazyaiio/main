import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { DeletionCheckForm } from "@/components/marketing/deletion-check-form";
import type { Block, Inline } from "@/lib/markdown";

function renderInline(nodes: Inline[]): ReactNode {
  return nodes.map((node, i) => {
    switch (node.type) {
      case "text":
        return <Fragment key={i}>{node.text}</Fragment>;
      case "strong":
        return <strong key={i}>{renderInline(node.children)}</strong>;
      case "em":
        return <em key={i}>{renderInline(node.children)}</em>;
      case "code":
        return (
          <code key={i} className="rounded bg-ink-100 px-1.5 py-0.5 text-sm">
            {node.text}
          </code>
        );
      case "link":
        return node.href.startsWith("/") || node.href.startsWith("#") ? (
          <Link key={i} href={node.href}>
            {renderInline(node.children)}
          </Link>
        ) : (
          <a key={i} href={node.href} target={node.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
            {renderInline(node.children)}
          </a>
        );
    }
  });
}

/** Draws parsed Markdown as plain elements. There is no raw HTML anywhere, so page text cannot run scripts. */
export type ArticleImage = { url: string; width: number; height: number; alt: string; credit: string; creditUrl: string; sourceUrl: string };

export function MarkdownContent({ blocks, images }: { blocks: Block[]; images?: Record<string, ArticleImage> }) {
  return (
    <>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "h2":
            return (
              <h2 key={i} id={block.id}>
                {renderInline(block.children)}
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} id={block.id}>
                {renderInline(block.children)}
              </h3>
            );
          case "p":
            return <p key={i}>{renderInline(block.children)}</p>;
          case "ul":
            return (
              <ul key={i}>
                {block.items.map((item, j) => (
                  <li key={j}>{renderInline(item)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i}>
                {block.items.map((item, j) => (
                  <li key={j}>{renderInline(item)}</li>
                ))}
              </ol>
            );
          case "form":
            return <DeletionCheckForm key={i} />;
          case "quote":
            return (
              <blockquote key={i} className="border-l-4 border-brand-200 bg-brand-50 px-4 py-3 text-ink-800">
                {renderInline(block.children)}
              </blockquote>
            );
          case "image": {
            const image = images?.[block.id];
            if (!image) return null;
            return (
              <figure key={i} className="my-8">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt={block.alt || image.alt} width={image.width} height={image.height} loading="lazy" decoding="async" className="h-auto w-full rounded-2xl" />
                {image.credit ? (
                  <figcaption className="mt-2 text-xs text-ink-500">
                    {image.sourceUrl ? (
                      <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer">
                        {image.credit}
                      </a>
                    ) : (
                      image.credit
                    )}
                  </figcaption>
                ) : null}
              </figure>
            );
          }
        }
      })}
    </>
  );
}
