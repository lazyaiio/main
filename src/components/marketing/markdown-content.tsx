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
export function MarkdownContent({ blocks }: { blocks: Block[] }) {
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
        }
      })}
    </>
  );
}
