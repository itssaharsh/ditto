// Drives Claude Code headless (`claude -p`) and turns its stream-json output into case events.
import { spawn } from 'node:child_process';

export interface AgentOptions {
  cwd: string;
  prompt: string;
  model?: string;
  resume?: string;
  addDirs?: string[];
  allowedTools?: string[];
  maxTurns?: number;
  timeoutMs?: number;
  onTool?: (tool: string, detail: string) => void;
  onText?: (text: string) => void;
}

export interface AgentResult {
  ok: boolean;
  sessionId?: string;
  model?: string;
  costUsd?: number;
  turns?: number;
  durationMs?: number;
  finalText?: string;
  error?: string;
}

export const DEFAULT_TOOLS = [
  'Read',
  'Edit',
  'Write',
  'Glob',
  'Grep',
  'Bash(npm install:*)',
  'Bash(npm run build:*)',
  'Bash(npx tsc:*)',
  'Bash(ls:*)',
  'Bash(mkdir:*)',
  'Bash(cat:*)',
];

function describeTool(name: string, input: Record<string, unknown>): string {
  const p = (input.file_path ?? input.path ?? input.pattern ?? input.command ?? '') as string;
  return String(p).replace(/^\/home\/[^/]+\//, '~/').slice(0, 160);
}

export function runClaude(opts: AgentOptions): Promise<AgentResult> {
  const args = ['-p', opts.prompt, '--output-format', 'stream-json', '--verbose'];
  args.push('--permission-mode', 'acceptEdits');
  args.push('--allowedTools', ...(opts.allowedTools ?? DEFAULT_TOOLS));
  // Keep the agent on the job: no user plugins, hooks, MCP servers or skills leak into it.
  args.push('--setting-sources', 'project', '--strict-mcp-config', '--disable-slash-commands');
  if (opts.model) args.push('--model', opts.model);
  if (opts.maxTurns) args.push('--max-turns', String(opts.maxTurns));
  if (opts.resume) args.push('--resume', opts.resume);
  for (const d of opts.addDirs ?? []) args.push('--add-dir', d);

  // Prefer the signed-in Claude subscription over a pay-per-call API key in the environment.
  const env = { ...process.env };
  if (!process.env.DITTO_AGENT_USE_API_KEY) delete env.ANTHROPIC_API_KEY;

  return new Promise((resolve) => {
    const child = spawn('claude', args, { cwd: opts.cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const result: AgentResult = { ok: false };
    let buf = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), opts.timeoutMs ?? 30 * 60_000);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      buf += chunk;
      let i: number;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith('{')) continue;
        let e: Record<string, unknown>;
        try {
          e = JSON.parse(line);
        } catch {
          continue;
        }
        if (e.type === 'system' && e.subtype === 'init') {
          result.sessionId = e.session_id as string;
          result.model = e.model as string;
        } else if (e.type === 'assistant') {
          const content = ((e.message as Record<string, unknown>)?.content ?? []) as Record<string, unknown>[];
          for (const block of content) {
            if (block.type === 'tool_use') {
              opts.onTool?.(String(block.name), describeTool(String(block.name), (block.input ?? {}) as Record<string, unknown>));
            } else if (block.type === 'text' && typeof block.text === 'string' && block.text.trim()) {
              opts.onText?.(block.text.trim());
            }
          }
        } else if (e.type === 'result') {
          result.ok = e.subtype === 'success' && e.is_error !== true;
          result.sessionId = (e.session_id as string) ?? result.sessionId;
          result.costUsd = typeof e.total_cost_usd === 'number' ? e.total_cost_usd : undefined;
          result.turns = typeof e.num_turns === 'number' ? e.num_turns : undefined;
          result.durationMs = typeof e.duration_ms === 'number' ? e.duration_ms : undefined;
          result.finalText = typeof e.result === 'string' ? e.result : undefined;
          if (!result.ok) result.error = String(e.subtype ?? 'error');
        }
      }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (c: string) => {
      stderr += c;
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (!result.ok && !result.error) result.error = stderr.trim().split('\n').slice(-3).join(' ') || `claude exited ${code}`;
      resolve(result);
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, error: err.message });
    });
  });
}
