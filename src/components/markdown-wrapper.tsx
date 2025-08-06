import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ content }: { content: string }) {
  return (
    <div className="prose dark:prose-invert whitespace-pre-wrap">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ ...props }) => <p {...props} className="whitespace-pre-wrap" />,
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
            <ul
              {...props}
              className="list-disc ml-2 list-inside whitespace-normal"
            />
          ),
          ol: ({ ...props }) => (
            <ol
              {...props}
              className="list-decimal ml-2 list-inside whitespace-normal"
            />
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
              className="border-l-2 border-muted-foreground whitespace-normal max-w-6xl pl-2"
            />
          ),
          hr: ({ ...props }) => (
            <hr {...props} className="my-4 border-muted-foreground" />
          ),
          table: ({ ...props }) => (
            <table
              {...props}
              className="border-collapse border border-muted-foreground"
            />
          ),
          th: ({ ...props }) => (
            <th
              {...props}
              className="border border-muted-foreground p-2 text-left"
            />
          ),
          td: ({ ...props }) => (
            <td
              {...props}
              className="border border-muted-foreground p-2 text-left"
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
