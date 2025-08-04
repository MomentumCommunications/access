import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ content }: { content: string }) {
  return (
    <div className="prose dark:prose-invert whitespace-pre-wrap">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ ...props }) => (
            <a
              {...props}
              className="underline underline-offset-2 text-blue-600 hover:text-blue-800 visited:text-purple-600 visited:hover:text-purple-800"
              target="_blank"
              rel="noopener noreferrer"
            />
          ),
          h1: ({ ...props }) => (
            <h1 {...props} className="text-2xl font-bold" />
          ),
          h2: ({ ...props }) => (
            <h2 {...props} className="text-xl font-semibold" />
          ),
          ul: ({ ...props }) => (
            <ul {...props} className="list-disc list-inside" />
          ),
          ol: ({ ...props }) => (
            <ol {...props} className="list-decimal list-inside" />
          ),
          li: ({ ...props }) => <li {...props} className="my-0 py-0" />,
          code: ({ ...props }) => (
            <code
              {...props}
              className="bg-slate-800/30 p-1 rounded w-min text-red-500"
            />
          ),
          img: ({ ...props }) => <img {...props} className="rounded-lg" />,
          blockquote: ({ ...props }) => (
            <blockquote
              {...props}
              className="border-l-2 border-muted-foreground max-w-6xl pl-2"
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
