import { useMemo } from 'react';

interface MarkdownRendererProps {
  content: string;
  streaming?: boolean;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>');
}

export function MarkdownRenderer({ content, streaming = false }: MarkdownRendererProps) {
  const html = useMemo(() => {
    if (!content && !streaming) return '';
    const text = escapeHtml(content);
    let html = text;
    html = html.replace(/```(\w+)?\n?([\s\S]*?)```/g, (_, lang, code) => {
      const langLabel = lang ? `<div style="font-size:10px;color:var(--text-3);margin-bottom:4px;">${lang}</div>` : '';
      return `${langLabel}<pre style="background:var(--bg-2);border:1px solid var(--border-c);border-radius:6px;padding:10px;overflow-x:auto;font-family:monospace;font-size:12px;line-height:1.5;margin:8px 0;"><code>${code.replace(/\n$/, '')}</code></pre>`;
    });
    html = html.replace(/`([^`]+)`/g, '<code style="background:var(--bg-2);border:1px solid var(--border-c);border-radius:4px;padding:1px 4px;font-family:monospace;font-size:0.9em;">$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:14px;font-weight:700;margin:12px 0 6px;">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:16px;font-weight:700;margin:14px 0 6px;">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 style="font-size:18px;font-weight:700;margin:16px 0 6px;">$1</h1>');
    html = html.replace(/^[\-\*] (.+)$/gm, '<li style="margin-left:16px;list-style:disc;">$1</li>');
    html = html.replace(/^\d+\. (.+)$/gm, '<li style="margin-left:16px;list-style:decimal;">$1</li>');
    html = html.replace(/^> (.+)$/gm, '<blockquote style="border-left:3px solid var(--accent);padding-left:10px;color:var(--text-2);margin:8px 0;">$1</blockquote>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" style="color:var(--accent);text-decoration:underline;">$1</a>');
    html = html.replace(/\n/g, '<br/>');
    return html;
  }, [content, streaming]);
  if (!html) return null;
  return (
    <div
      style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6, fontSize: '13.5px' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}