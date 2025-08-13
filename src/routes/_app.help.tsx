import { createFileRoute } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { Badge } from "~/components/ui/badge";

export const Route = createFileRoute("/_app/help")({
  component: RouteComponent,
});

function RouteComponent() {
  const isMac = navigator.userAgent.includes("Mac");

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">Access Momentum Help</h1>
          <p className="text-xl text-muted-foreground">
            Everything you need to know about using Access Momentum
          </p>
        </div>

        {/* Getting Started */}
        <Card>
          <CardHeader>
            <CardTitle>🚀 Getting Started</CardTitle>
            <CardDescription>
              Learn the basics of Access Momentum
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              <strong>Access Momentum</strong> is a real-time communication
              platform designed for organizations to stay connected and informed
              about the year's events and activities.
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm">
              <li>
                <strong>Home Page:</strong> View important bulletins,
                announcements, and year's events
              </li>
              <li>
                <strong>Channels:</strong> Public and private spaces for team
                discussions
              </li>
              <li>
                <strong>Direct Messages:</strong> One-on-one or group
                conversations
              </li>
              <li>
                <strong>Search:</strong> Find messages, channels, and people
                quickly
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Navigation */}
        <Card>
          <CardHeader>
            <CardTitle>🧭 Navigation & Search</CardTitle>
            <CardDescription>Find your way around the platform</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold">Quick Search</h4>
                <p className="text-sm text-muted-foreground">
                  Press{" "}
                  <kbd className="px-2 py-1 text-xs bg-muted rounded">
                    {isMac ? "⌘+F" : "Ctrl+F"}
                  </kbd>{" "}
                  to quickly search channels, direct messages, and message
                  content.
                </p>
              </div>
              <div>
                <h4 className="font-semibold">Message Links</h4>
                <p className="text-sm text-muted-foreground">
                  Click on message timestamps to get shareable links that jump
                  directly to specific messages.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Messaging Features */}
        <Card>
          <CardHeader>
            <CardTitle>💬 Messaging Features</CardTitle>
            <CardDescription>
              Communicate effectively with these tools
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">Message Actions</h4>
                <ul className="text-sm space-y-1">
                  <li>
                    • <strong>Reply:</strong> Click reply button to respond to
                    specific messages
                  </li>
                  <li>
                    • <strong>React:</strong> Add emoji reactions to express
                    feedback
                  </li>
                  <li>
                    • <strong>Edit:</strong> Modify your own messages (shows
                    "edited" indicator)
                  </li>
                  <li>
                    • <strong>Delete:</strong> Remove your messages permanently
                  </li>
                  <li>
                    • <strong>Copy Link:</strong> Share direct links to specific
                    messages
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Keyboard Shortcuts</h4>
                <ul className="text-sm space-y-1">
                  <li>
                    • <strong>Enter:</strong> Send message
                  </li>
                  <li>
                    • <strong>Shift+Enter:</strong> New line in message
                  </li>
                  <li>
                    • <strong>{isMac ? "⌘+F" : "Ctrl+F"}:</strong> Open search
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Text Formatting */}
        <Card>
          <CardHeader>
            <CardTitle>✏️ Text Formatting</CardTitle>
            <CardDescription>
              For now you can only style text with Markdown. Text styling
              buttons may be added in the future
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-semibold">You Type</th>
                    <th className="text-left p-2 font-semibold">Result</th>
                    <th className="text-left p-2 font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody className="space-y-2">
                  <tr className="border-b">
                    <td className="p-2 font-mono bg-muted/30 rounded">
                      **bold text**
                    </td>
                    <td className="p-2">
                      <strong>bold text</strong>
                    </td>
                    <td className="p-2 text-muted-foreground">Bold text</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-mono bg-muted/30 rounded">
                      *italic text*
                    </td>
                    <td className="p-2">
                      <em>italic text</em>
                    </td>
                    <td className="p-2 text-muted-foreground">Italic text</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-mono bg-muted/30 rounded">
                      ~~strikethrough~~
                    </td>
                    <td className="p-2">
                      <del>strikethrough</del>
                    </td>
                    <td className="p-2 text-muted-foreground">
                      Strikethrough text
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-mono bg-muted/30 rounded">
                      `code`
                    </td>
                    <td className="p-2">
                      <code className="bg-muted px-1 rounded">code</code>
                    </td>
                    <td className="p-2 text-muted-foreground">Inline code</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-mono bg-muted/30 rounded">
                      ```
                      <br />
                      code block
                      <br />
                      ```
                    </td>
                    <td className="p-2">
                      <pre className="bg-muted w-1/2 p-2 rounded text-xs">
                        code block
                      </pre>
                    </td>
                    <td className="p-2 text-muted-foreground">Code block</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-mono bg-muted/30 rounded">
                      # Heading 1
                    </td>
                    <td className="p-2">
                      <h1 className="text-lg font-bold">Heading 1</h1>
                    </td>
                    <td className="p-2 text-muted-foreground">Large heading</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-mono bg-muted/30 rounded">
                      ## Heading 2
                    </td>
                    <td className="p-2">
                      <h2 className="text-base font-semibold">Heading 2</h2>
                    </td>
                    <td className="p-2 text-muted-foreground">
                      Medium heading
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-mono bg-muted/30 rounded">
                      - List item
                    </td>
                    <td className="p-2">• List item</td>
                    <td className="p-2 text-muted-foreground">Bullet list</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-mono bg-muted/30 rounded">
                      1. Numbered item
                    </td>
                    <td className="p-2">1. Numbered item</td>
                    <td className="p-2 text-muted-foreground">Numbered list</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-mono bg-muted/30 rounded">
                      &gt; Quote text
                    </td>
                    <td className="p-2">
                      <blockquote className="border-l-2 border-muted-foreground/20 pl-2 text-muted-foreground">
                        Quote text
                      </blockquote>
                    </td>
                    <td className="p-2 text-muted-foreground">Block quote</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-mono bg-muted/30 rounded">
                      [Link](https://example.com)
                    </td>
                    <td className="p-2">
                      <a href="#" className="text-blue-600 underline">
                        Link
                      </a>
                    </td>
                    <td className="p-2 text-muted-foreground">
                      Clickable link
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 font-mono bg-muted/30 rounded">
                      ![Alt text](https://example.com)
                    </td>
                    <td className="p-2">
                      <img
                        className="w-1/2"
                        src="https://media3.giphy.com/media/d3mlE7uhX8KFgEmY/giphy.gif"
                        alt="Think about it meme"
                      />
                    </td>
                    <td className="p-2 text-muted-foreground">
                      Image link and gifs
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Channels & Permissions */}
        <Card>
          <CardHeader>
            <CardTitle>🔐 Channels & Permissions</CardTitle>
            <CardDescription>
              Understanding access levels and channel types
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">Channel Types</h4>
                <ul className="text-sm space-y-2">
                  <li className="flex items-center gap-2">
                    <Badge variant="secondary"># Public</Badge>
                    <span>Everyone in the organization can see and join</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Badge variant="outline">🔒 Private</Badge>
                    <span>Only invited members can access</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Badge variant="secondary">💬 DMs</Badge>
                    <span>Direct messages between users</span>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Permissions</h4>
                <ul className="text-sm space-y-2">
                  <li>
                    <strong>Admins can:</strong> Create channels, manage users,
                    post bulletins
                  </li>
                  <li>
                    <strong>All users can:</strong> Create direct messages, join
                    public channels
                  </li>
                  <li>
                    <strong>Admin-controlled channels:</strong> Only admins can
                    post messages
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features & Tips */}
        <Card>
          <CardHeader>
            <CardTitle>💡 Features & Tips</CardTitle>
            <CardDescription>Make the most of Access Momentum</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2">Smart Features</h4>
                <ul className="text-sm space-y-1">
                  <li>
                    • <strong>Date Separators:</strong> Messages are grouped by
                    day
                  </li>
                  <li>
                    • <strong>Read Receipts:</strong> See which messages you've
                    read
                  </li>
                  <li>
                    • <strong>Real-time Updates:</strong> Messages appear
                    instantly
                  </li>
                  <li>
                    • <strong>Image Upload:</strong> Share images in messages
                  </li>
                  <li>
                    • <strong>Message History:</strong> Scroll up to load older
                    messages
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Pro Tips</h4>
                <ul className="text-sm space-y-1">
                  <li>• Use reactions to acknowledge messages quickly</li>
                  <li>• Reply to specific messages to maintain context</li>
                  <li>• Check the home page for important announcements</li>
                  <li>• Use private channels for sensitive discussions</li>
                  <li>• Search supports spaces: try "project update"</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center pt-8">
          <Separator className="mb-6" />
          <p className="text-sm text-muted-foreground">
            Need more help? Contact your system administrator or check the home
            page for updates.
          </p>
        </div>
      </div>
    </div>
  );
}
